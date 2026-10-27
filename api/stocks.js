// Vercel serverless function: precios de acciones y ETFs de EE. UU. desde Finnhub (USD).
// Uso:  /api/stocks?q=apple            -> sugerencias de tickers
//       /api/stocks?symbols=AAPL,VOO   -> precio actual y cambio del día
// Necesita la variable de entorno FINNHUB_API_KEY (key gratis en finnhub.io); nunca
// va escrita en el código. El plan gratis permite 60 consultas/min, así que los
// precios se guardan en memoria unos minutos y las búsquedas un día.

const QUOTE_TTL = 3 * 60 * 1000;
const SEARCH_TTL = 24 * 60 * 60 * 1000;
const MAX_SYMBOLS = 30;
const quotes = new Map();   // 'AAPL' -> { t, data }
const searches = new Map(); // 'apple' -> { t, results }

// Tickers aceptados al pedir precios: letras, números, punto o guion (ej. BRK.B)
const isTicker = s => /^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(s);
// En el buscador solo tickers de EE. UU.: sin sufijo de bolsa extranjera
// (VOD.L, SAP.DE), pero sí clases de acciones (BRK.B)
const isUsTicker = s => /^[A-Z0-9]{1,6}(\.[ABC])?$/.test(s);
// Tipos que interesan en el buscador (acciones y ETFs)
const TYPES = new Set(['Common Stock', 'ETP', 'ETF', 'ADR', 'REIT']);

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
