// Vercel serverless function: movimientos y saldos de wallets (solo lectura, direcciones públicas).
// Uso:  /api/chain?net=eth&address=0x…&start=<bloque>  -> txs de ETH (normales e internas) desde ese bloque + saldo
//       /api/chain?net=trx&address=T…&since=<ms>       -> txs de TRX y TRC20 (USDT/USDC) desde esa fecha + saldos
//       /api/chain?prices=<id de CoinGecko>            -> precio diario del último año (para valuar movimientos)
// Las keys van en variables de entorno, nunca en el código: ETHERSCAN_API_KEY (obligatoria
// para ETH) y TRONGRID_API_KEY (opcional: sin ella TronGrid funciona con un límite más bajo).

const crypto = require('crypto');

const LIVE_TTL = 8 * 1000;           // evita repetir la misma consulta si hay dos pestañas abiertas
const PRICES_TTL = 6 * 60 * 60 * 1000;
const cache = new Map();             // clave -> { t, data }

const isEth = s => /^0x[0-9a-fA-F]{40}$/.test(s);
const isTron = s => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s);
const isCoinId = s => /^[a-z0-9-]{1,40}$/.test(s);

// Tokens TRC20 que se siguen (el resto se ignora)
const TRC20 = {
  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: { coin: 'tether', decimals: 6 },   // USDT
  TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8: { coin: 'usd-coin', decimals: 6 }  // USDC
};

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json', ...headers } });
  const text = await r.text();
  if (!r.ok) throw httpError(502, new URL(url).host + ' respondió ' + r.status + ': ' + text.slice(0, 120));
  try { return JSON.parse(text); } catch (e) { throw httpError(502, new URL(url).host + ' devolvió algo que no es JSON'); }
}

async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.data;
  const data = await fn();
  cache.set(key, { t: Date.now(), data });
  return data;
}

// ---- ETH (Etherscan API V2, chainid 1) ----
async function etherscan(params) {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) throw httpError(500, 'Falta configurar ETHERSCAN_API_KEY en Vercel');
  const url = 'https://api.etherscan.io/v2/api?' + new URLSearchParams({ chainid: '1', ...params, apikey: key });
  const d = await getJson(url);
  // "No transactions found" llega como status 0 con result vacío: no es un error
  if (d.status === '0' && !Array.isArray(d.result)) throw httpError(502, 'Etherscan: ' + (d.result || d.message));
  return d.result;
}

async function eth(address, start) {
  const range = { address, startblock: String(start), endblock: '99999999', sort: 'asc' };
  // En serie: el plan gratis de Etherscan permite 5 consultas por segundo
  const normal = await etherscan({ module: 'account', action: 'txlist', ...range });
  const internal = await etherscan({ module: 'account', action: 'txlistinternal', ...range });
  const balance = await etherscan({ module: 'account', action: 'balance', address, tag: 'latest' });
  const wei = v => Number(BigInt(v || '0')) / 1e18;
  const txs = [];
  let last = start;
  for (const t of normal || []) {
    last = Math.max(last, +t.blockNumber);
    if (t.isError === '1' || t.value === '0') continue;
    txs.push({ txid: t.hash, time: +t.timeStamp * 1000, from: t.from, to: t.to || t.contractAddress, amount: wei(t.value), coin: 'ethereum' });
  }
  (internal || []).forEach((t, i) => {
    last = Math.max(last, +t.blockNumber);
    if (t.isError === '1' || t.value === '0') return;
    txs.push({ txid: t.hash, idx: 'i' + (t.traceId || i), time: +t.timeStamp * 1000, from: t.from, to: t.to, amount: wei(t.value), coin: 'ethereum' });
  });
  return { txs, last, balances: { ethereum: wei(balance) } };
}

// ---- TRON (TronGrid) ----
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(buf) {
  let x = BigInt('0x' + buf.toString('hex'));
  let s = '';
  while (x > 0n) { s = B58[Number(x % 58n)] + s; x /= 58n; }
  for (const b of buf) { if (b === 0) s = '1' + s; else break; }
  return s;
}
// TronGrid devuelve las direcciones en hex ("41…"); se pasan al formato T… de siempre
function tronAddress(hex) {
  if (!hex) return null;
  const b = Buffer.from(hex, 'hex');
  const sha = x => crypto.createHash('sha256').update(x).digest();
  return base58(Buffer.concat([b, sha(sha(b)).subarray(0, 4)]));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// TronGrid limita las consultas por segundo (mucho más sin key): pausa corta entre
// consultas y un reintento si responde 429
async function tronGrid(path, params = {}) {
  const key = process.env.TRONGRID_API_KEY;
  const url = 'https://api.trongrid.io' + path + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
  for (let attempt = 0; ; attempt++) {
    await sleep(key ? 60 : 1200);
    try {
      return await getJson(url, key ? { 'TRON-PRO-API-KEY': key } : {});
    } catch (e) {
      if (attempt < 1 && / 429:/.test(e.message)) { await sleep(1500); continue; }
      throw e;
    }
  }
}

// Pide páginas de 50 desde "since" hacia adelante (hasta 4 por consulta; la siguiente sigue desde ahí)
async function tronPages(path, since) {
  const out = [];
  let fingerprint;
  for (let page = 0; page < 4; page++) {
    const params = { only_confirmed: 'true', limit: '50', order_by: 'block_timestamp,asc', min_timestamp: String(since) };
    if (fingerprint) params.fingerprint = fingerprint;
    const d = await tronGrid(path, params);
    out.push(...(d.data || []));
    fingerprint = d.meta && d.meta.fingerprint;
    if (!fingerprint || (d.data || []).length < 50) break;
  }
  return out;
}

async function trx(address, since) {
  const acct = ((await tronGrid('/v1/accounts/' + address)).data || [])[0] || {};
  const balances = { tron: (acct.balance || 0) / 1e6 };
  for (const entry of acct.trc20 || []) {
    for (const [contract, raw] of Object.entries(entry)) {
      const tk = TRC20[contract];
      if (tk) balances[tk.coin] = Number(raw) / 10 ** tk.decimals;
    }
  }
  const txs = [];
  let last = since;
  for (const t of await tronPages('/v1/accounts/' + address + '/transactions', since)) {
    last = Math.max(last, t.block_timestamp || 0);
    const c = (t.raw_data && t.raw_data.contract || [])[0];
    if (!c || c.type !== 'TransferContract' || (t.ret && t.ret[0] && t.ret[0].contractRet !== 'SUCCESS')) continue;
    const v = c.parameter.value;
    txs.push({ txid: t.txID, time: t.block_timestamp, from: tronAddress(v.owner_address), to: tronAddress(v.to_address), amount: v.amount / 1e6, coin: 'tron' });
  }
  for (const t of await tronPages('/v1/accounts/' + address + '/transactions/trc20', since)) {
    last = Math.max(last, t.block_timestamp || 0);
    const tk = TRC20[t.token_info && t.token_info.address];
    if (!tk) continue;
    txs.push({ txid: t.transaction_id, idx: tk.coin, time: t.block_timestamp, from: t.from, to: t.to, amount: Number(t.value) / 10 ** tk.decimals, coin: tk.coin });
  }
  return { txs, last, balances };
}

// ---- Precio diario del último año (CoinGecko) ----
async function dailyPrices(id) {
  const d = await getJson(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`);
  const prices = {};
  for (const [ms, p] of d.prices || []) prices[new Date(ms).toISOString().slice(0, 10)] = p;
  return prices;
}

module.exports = async (req, res) => {
  const { net, address, prices } = req.query;
  try {
    if (prices) {
      if (!isCoinId(prices)) throw httpError(400, 'Moneda inválida');
      const data = await cached('p:' + prices, PRICES_TTL, () => dailyPrices(prices));
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
      return res.status(200).json({ prices: data });
    }
    res.setHeader('Cache-Control', 'no-store');
    if (net === 'eth') {
      if (!isEth(address)) throw httpError(400, 'Dirección de ETH inválida');
      const start = Math.max(0, parseInt(req.query.start, 10) || 0);
      return res.status(200).json(await cached(`eth:${address}:${start}`, LIVE_TTL, () => eth(address, start)));
    }
    if (net === 'trx') {
      if (!isTron(address)) throw httpError(400, 'Dirección de TRON inválida');
      const since = Math.max(0, parseInt(req.query.since, 10) || 0);
      return res.status(200).json(await cached(`trx:${address}:${since}`, LIVE_TTL, () => trx(address, since)));
    }
    throw httpError(400, 'Falta net (eth o trx) o prices');
  } catch (e) {
    return res.status(e.status || 502).json({ error: String(e.message || e) });
  }
};
