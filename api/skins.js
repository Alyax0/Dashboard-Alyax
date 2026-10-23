// Vercel serverless function: precios de skins CS2 desde Skinport (USD).
// Uso:  /api/skins?q=ak redline          -> sugerencias de nombres
//       /api/skins?names=Nombre1%0ANombre2 -> precios de esas skins (separadas por salto de línea,
//                                          porque los nombres ya llevan '|')
// Skinport cachea 5 min y limita a 8 requests / 5 min, así que se guarda en memoria.

const TTL = 5 * 60 * 1000;
let cache = { t: 0, items: null };

async function loadItems() {
  if (cache.items && Date.now() - cache.t < TTL) return cache.items;
  const r = await fetch('https://api.skinport.com/v1/items?app_id=730&currency=USD', {
    headers: { 'Accept-Encoding': 'br' }
  });
  if (!r.ok) throw new Error('Skinport respondió ' + r.status);
  const data = await r.json();
  const items = {};
  for (const i of data) {
    items[i.market_hash_name.toLowerCase()] = {
      name: i.market_hash_name,
      min: i.min_price,
      sug: i.suggested_price
    };
  }
  cache = { t: Date.now(), items };
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
    return res.status(200).json({ results });
  }

  if (names) {
    const prices = {};
    String(names).split('\n').forEach(n => {
      const it = items[n.trim().toLowerCase()];
      if (it) prices[n] = it;
    });
    return res.status(200).json({ prices });
  }

  return res.status(400).json({ error: 'Falta q o names' });
};
