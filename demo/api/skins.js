// Vercel serverless function: precios de skins CS2 desde CSFloat (USD).
// Uso:  /api/skins?q=ak redline          -> sugerencias de nombres
//       /api/skins?names=Nombre1%0ANombre2 -> precios de esas skins (separadas por salto de línea,
//                                          porque los nombres ya llevan '|')
// Fuente: la lista pública de precios de CSFloat (sin key), con el precio más bajo publicado
// de cada skin. Si falla, se usa la copia de esos precios que publica CSGO Trader cada hora.
// La lista completa se guarda en memoria 5 min.

const https = require('https');
const zlib = require('zlib');

const CSFLOAT = 'https://csfloat.com/api/v1/listings/price-list';
const MIRROR = 'https://prices.csgotrader.app/latest/csfloat.json';
const TTL = 5 * 60 * 1000;
let cache = { t: 0, items: null, source: null };

// GET que acepta respuestas en Brotli o gzip
function getJson(url) {
  return new Promise((resolve, reject) => {
    const host = new URL(url).host;
    const req = https.get(url, { headers: { 'Accept-Encoding': 'br, gzip', 'Accept': 'application/json', 'User-Agent': 'dashboard-alyax' } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let body = Buffer.concat(chunks);
        try {
          const enc = res.headers['content-encoding'];
          if (enc === 'br') body = zlib.brotliDecompressSync(body);
          else if (enc === 'gzip') body = zlib.gunzipSync(body);
        } catch (e) { /* si no se puede descomprimir, se muestra tal cual */ }
        const text = body.toString('utf8');
        if (res.statusCode !== 200) return reject(new Error(host + ' respondió ' + res.statusCode + ': ' + text.slice(0, 120)));
        try { resolve(JSON.parse(text)); } catch (e) { reject(new Error(host + ' devolvió algo que no es JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error(host + ' tardó demasiado')));
  });
}

async function loadItems() {
  if (cache.items && Date.now() - cache.t < TTL) return cache.items;
  const items = {};
  let source;
  try {
    // CSFloat: [{ market_hash_name, quantity, min_price }] con min_price en centavos
    const data = await getJson(CSFLOAT);
    if (!Array.isArray(data) || !data.length) throw new Error('CSFloat devolvió una lista vacía');
    for (const i of data) {
      items[i.market_hash_name.toLowerCase()] = { name: i.market_hash_name, min: i.min_price / 100, sug: null };
    }
    source = 'csfloat';
  } catch (e) {
    // Copia de CSGO Trader: { 'AK-47 | Redline (Field-Tested)': { price, starting_at: { price } } } en USD
    const data = await getJson(MIRROR);
    for (const name of Object.keys(data)) {
      const p = data[name] || {};
      const min = (p.starting_at && p.starting_at.price) ?? p.price ?? null;
      items[name.toLowerCase()] = { name, min, sug: null };
    }
    source = 'csfloat-copia';
  }
  cache = { t: Date.now(), items, source };
  return items;
}

module.exports = async (req, res) => {
  let items;
  try {
    items = await loadItems();
  } catch (e) {
    if (cache.items) items = cache.items; // si falla, usa el último guardado
    else return res.status(502).json({ error: String(e.message || e) });
  }

  const { q, names } = req.query;
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=240');

  if (q) {
    const tokens = String(q).toLowerCase().split(/\s+/).filter(Boolean);
    const results = Object.keys(items)
      .filter(k => tokens.every(t => k.includes(t)))
      .sort((a, b) => a.length - b.length)
      .slice(0, 12)
      .map(k => items[k].name);
    return res.status(200).json({ results, source: cache.source });
  }

  if (names) {
    const prices = {};
    String(names).split('\n').forEach(n => {
      const it = items[n.trim().toLowerCase()];
      if (it) prices[n] = it;
    });
    return res.status(200).json({ prices, source: cache.source });
  }

  return res.status(400).json({ error: 'Falta q o names' });
};
