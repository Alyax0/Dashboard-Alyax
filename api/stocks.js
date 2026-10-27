// Vercel serverless function: precios de acciones y ETFs de EE. UU. desde Finnhub (USD).
// Uso:  /api/stocks?q=apple            -> sugerencias de tickers
//       /api/stocks?symbols=AAPL,VOO   -> precio actual y cambio del día
//       /api/stocks?history=AAPL       -> cierres diarios del último mes (Yahoo, sin key)
//       /api/stocks?history=bitcoin&kind=crypto -> lo mismo para cripto (CoinGecko, sin key)
// Necesita la variable de entorno FINNHUB_API_KEY (key gratis en finnhub.io); nunca
// va escrita en el código. El plan gratis permite 60 consultas/min, así que los
// precios se guardan en memoria unos minutos y las búsquedas un día.

const QUOTE_TTL = 3 * 60 * 1000;
const SEARCH_TTL = 24 * 60 * 60 * 1000;
const MAX_SYMBOLS = 30;
const HISTORY_TTL = 60 * 60 * 1000;
const quotes = new Map();    // 'AAPL' -> { t, data }
const searches = new Map();  // 'apple' -> { t, results }
const histories = new Map(); // 's:AAPL' / 'c:bitcoin' -> { t, points }

// Tickers aceptados al pedir precios: letras, números, punto o guion (ej. BRK.B)
const isTicker = s => /^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(s);
// En el buscador solo tickers de EE. UU.: sin sufijo de bolsa extranjera
// (VOD.L, SAP.DE), pero sí clases de acciones (BRK.B)
const isUsTicker = s => /^[A-Z0-9]{1,6}(\.[ABC])?$/.test(s);
// Tipos que interesan en el buscador (acciones y ETFs)
const TYPES = new Set(['Common Stock', 'ETP', 'ETF', 'ADR', 'REIT']);
// Ids de CoinGecko (ej. bitcoin, the-open-network)
const isCoinId = s => /^[a-z0-9-]{1,40}$/.test(s);

// Cierres diarios del último mes: [[timestamp ms, precio USD], ...]
async function getHistory(id, crypto) {
  const key = (crypto ? 'c:' : 's:') + id;
  const hit = histories.get(key);
  if (hit && Date.now() - hit.t < HISTORY_TTL) return hit.points;
  try {
    let points;
    if (crypto) {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30&interval=daily`);
      if (!r.ok) throw new Error('CoinGecko respondió ' + r.status);
      points = ((await r.json()).prices || []).filter(p => typeof p[1] === 'number');
    } else {
      // Yahoo usa guion en las clases de acciones (BRK.B -> BRK-B)
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(id.replace('.', '-'))}?range=1mo&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error('Yahoo respondió ' + r.status);
      const result = (((await r.json()).chart || {}).result || [])[0] || {};
      const ts = result.timestamp || [];
      const close = (((result.indicators || {}).quote || [])[0] || {}).close || [];
      points = ts.map((t, i) => [t * 1000, close[i]]).filter(p => typeof p[1] === 'number');
    }
    if (points.length < 2) throw new Error('Sin historial');
    histories.set(key, { t: Date.now(), points });
    return points;
  } catch (e) {
    if (hit) return hit.points; // si falla, usa el último guardado
    throw e;
  }
}

async function finnhub(path, params) {
  const url = 'https://finnhub.io/api/v1/' + path + '?' + new URLSearchParams(params);
  const r = await fetch(url, { headers: { 'X-Finnhub-Token': process.env.FINNHUB_API_KEY } });
  if (!r.ok) throw new Error('Finnhub respondió ' + r.status);
  return r.json();
}

async function getQuote(symbol) {
  const hit = quotes.get(symbol);
  if (hit && Date.now() - hit.t < QUOTE_TTL) return hit.data;
  try {
    const q = await finnhub('quote', { symbol });
    // Un ticker que no existe vuelve con todo en 0
    const data = q && q.c ? { price: q.c, change: q.d || 0, changePct: q.dp || 0, prevClose: q.pc || null, t: q.t || null } : null;
    quotes.set(symbol, { t: Date.now(), data });
    return data;
  } catch (e) {
    if (hit) return hit.data; // si falla, usa el último guardado
    throw e;
  }
}

module.exports = async (req, res) => {
  // El historial no usa Finnhub, así que no necesita la key
  if (req.query.history) {
    const crypto = req.query.kind === 'crypto';
    const id = crypto ? String(req.query.history).toLowerCase() : String(req.query.history).toUpperCase();
    if (!(crypto ? isCoinId(id) : isTicker(id))) return res.status(400).json({ error: 'Ticker inválido' });
    try {
      const points = await getHistory(id, crypto);
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3000');
      return res.status(200).json({ points });
    } catch (e) {
      return res.status(502).json({ error: String(e.message || e) });
    }
  }

  if (!process.env.FINNHUB_API_KEY) {
    return res.status(500).json({ error: 'Falta configurar FINNHUB_API_KEY en Vercel' });
  }
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  const { q, symbols } = req.query;

  if (q) {
    const key = String(q).trim().toLowerCase().slice(0, 40);
    if (!key) return res.status(200).json({ results: [] });
    const hit = searches.get(key);
    if (hit && Date.now() - hit.t < SEARCH_TTL) return res.status(200).json({ results: hit.results });
    try {
      const data = await finnhub('search', { q: key });
      const results = (data.result || [])
        .filter(r => TYPES.has(r.type) && isUsTicker(r.symbol))
        .slice(0, 10)
        .map(r => ({ symbol: r.symbol, name: r.description, type: r.type }));
      searches.set(key, { t: Date.now(), results });
      return res.status(200).json({ results });
    } catch (e) {
      if (hit) return res.status(200).json({ results: hit.results });
      return res.status(502).json({ error: String(e.message || e) });
    }
  }

  if (symbols) {
    const list = [...new Set(String(symbols).toUpperCase().split(',').map(s => s.trim()).filter(isTicker))].slice(0, MAX_SYMBOLS);
    const out = {};
    let failed = 0;
    await Promise.all(list.map(async s => {
      try {
        const data = await getQuote(s);
        if (data) out[s] = data;
      } catch (e) {
        failed++;
      }
    }));
    if (failed && !Object.keys(out).length) return res.status(502).json({ error: 'No se pudieron traer los precios' });
    return res.status(200).json({ quotes: out });
  }

  return res.status(400).json({ error: 'Falta q o symbols' });
};
