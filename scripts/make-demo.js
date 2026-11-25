// Genera demo/index.html a partir del index.html del dashboard, con lo propio de la demo:
// datos de ejemplo + "Reiniciar demo", claves de guardado propias, sin datos personales
// ni ejemplos de gambling. También copia a demo/ las funciones de /api y la lista de activos,
// porque el proyecto de la demo en Vercel solo ve esa carpeta.
// Uso, desde la raíz del repo: node scripts/make-demo.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'index.html');
const dst = path.join(root, 'demo', 'index.html');
let s = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
function rep(from, to, count = 1) {
  const n = s.split(from).length - 1;
  if (count === 'all' ? n < 1 : n !== count) throw new Error(`esperaba ${count} y encontré ${n}: ${from.slice(0, 90)}`);
  s = s.split(from).join(to);
}

// Nombre, ícono y descripción propios (sin la foto ni el nombre del dashboard real)
rep(`<title>Dashboard Alyax</title>`, `<title>Tracker de Finanzas · Demo</title>
<meta name="description" content="Demo de un tracker de finanzas multi-plataforma: movimientos, cripto, acciones, skins CS2 y exploración de activos con precios en vivo." />`);
rep(`<link rel="icon" type="image/jpeg" href="alyax.jpg">`,
    `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%234a4ae8'/><path d='M8 22l5-6 4 3 7-9' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>">`);
rep(`<div class="logo">Dashboard<span> </span>Alyax</div>`, `<div class="logo">Tracker<span> </span>Finanzas<span class="demo-badge">demo</span></div>`);

// Claves de guardado propias: nunca se mezclan con las del dashboard real
rep(`'alyax_theme'`, `'finanzas_demo_theme'`, 2);
rep(`const STORAGE_KEY = 'alyax_dashboard_v1';`, `// Distinta a la del dashboard real para que nunca se mezclen los datos\nconst STORAGE_KEY = 'finanzas_demo_v1';`);
rep(`const RATES_KEY = 'alyax_rates';`, `const RATES_KEY = 'finanzas_demo_rates';`);
rep(`const CURRENCY_KEY = 'alyax_currency';`, `const CURRENCY_KEY = 'finanzas_demo_currency';`);

// Sin seguimiento en vivo de wallets: las direcciones de ejemplo son inventadas
rep(`const CHAIN_LIVE = true;`, `const CHAIN_LIVE = false;`);

// Ejemplos sin plataformas de gambling
rep(`roobet ltc`, `binance btc`, 'all');
rep(`placeholder="Sitio (ej. Roobet)"`, `placeholder="Sitio (ej. Binance)"`);

// Aviso de demo con el botón "Reiniciar demo", visible en todas las pestañas
rep(`<div class="page">\n\n`, `<div class="page">

  <!-- Aviso de demo -->
  <div class="demo-bar">
    <span><b>Demo</b> · Tracker de finanzas multi-plataforma con datos de ejemplo. Tus cambios se guardan solo en este navegador.</span>
    <button class="btn-refresh" type="button" onclick="resetDemo()" title="Borra tus cambios y vuelve a cargar los datos de ejemplo">↺ Reiniciar demo</button>
  </div>

`);
rep(`  /* ---- BARRA SUPERIOR (estilo GBM) ---- */`, `  /* ---- DEMO ---- */
  .demo-badge {
    font-family: var(--mono); font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--accent); background: var(--accent-dim); border-radius: 999px; padding: 3px 8px; margin-left: 8px; vertical-align: middle;
  }
  .demo-bar {
    display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap;
    background: var(--accent-dim); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 12.5px; color: var(--text-muted);
  }
  .demo-bar b { color: var(--text); }

  /* ---- BARRA SUPERIOR (estilo GBM) ---- */`);
rep(`<footer>los datos se guardan automáticamente en tu navegador 💾</footer>`, `<footer>demo con datos de ejemplo · tus cambios se guardan solo en este navegador 💾</footer>`);

// Datos de ejemplo la primera vez (y al reiniciar)
rep(`// ---- LOAD STATE ----`, `// ---- DATOS DE EJEMPLO (demo) ----
// Fechas relativas a hoy para que la demo siempre se vea reciente.
// Las direcciones de wallets son inventadas.
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function seedDemo() {
  let txId = 1;
  // Movimientos de ejemplo agrupados por plataforma (se ven con el nombre adelante)
  const site = (id, name, txs) => ({
    id, name, open: true,
    txs: txs.map(([d, type, amount, note]) => ({ id: txId++, date: daysAgo(d), type, amount, note }))
            .sort((a, b) => b.date.localeCompare(a.date))
  });
  state.sites = [
    site(1, 'Binance', [
      [118, 'dep', 1500,   'Fondeo inicial desde banco'],
      [84,  'dep', 750,    'Aporte mensual'],
      [53,  'dep', 750,    'Aporte mensual'],
      [21,  'ret', 1320.4, 'Toma de ganancias a cuenta'],
    ]),
    site(2, 'PayPal', [
      [96,  'ret', 860,    'Cobro proyecto freelance'],
      [61,  'dep', 120,    'Suscripciones y compras'],
      [33,  'ret', 1240.5, 'Cobro cliente diseño web'],
      [9,   'dep', 64.99,  'Pago de software'],
    ]),
    site(3, 'Wise', [
      [102, 'dep', 2000,   'Envío desde banco MX'],
      [70,  'ret', 1955.3, 'Conversión MXN → USD'],
      [14,  'dep', 500,    'Fondo de viaje'],
    ]),
    site(4, 'Mercado Pago', [
      [88,  'dep', 300,    'Recarga'],
      [45,  'ret', 180.75, 'Reembolsos y cashback'],
      [6,   'dep', 150,    'Recarga'],
    ]),
    site(5, 'Kraken', [
      [77,  'dep', 1000,   'DCA trimestral'],
      [12,  'ret', 420,    'Rebalanceo de cartera'],
    ]),
  ];
  state.holdings = [
    { id: 1, coin: 'bitcoin',  usd: 2450,  amount: 0.0385, date: daysAgo(118) },
    { id: 2, coin: 'ethereum', usd: 1500,  amount: 0.92,   date: daysAgo(84) },
    { id: 3, coin: 'solana',   usd: 900,   amount: 14.5,   date: daysAgo(53) },
    { id: 4, coin: 'litecoin', usd: 260,   amount: 6.2,    date: daysAgo(40) },
    { id: 5, coin: 'usd-coin', usd: 600,   amount: 600,    date: daysAgo(12) },
  ].map(h => ({ ...h, entryPrice: h.usd / h.amount }));
  state.stocks = [
    { id: 1, symbol: 'AAPL', name: 'Apple Inc.',           qty: 4, cost: 1160, date: daysAgo(100) },
    { id: 2, symbol: 'VOO',  name: 'Vanguard S&P 500 ETF', qty: 2, cost: 1280, date: daysAgo(90) },
    { id: 3, symbol: 'NVDA', name: 'NVIDIA Corp',          qty: 6, cost: 1080, date: daysAgo(45) },
  ];
  state.wallets = [
    { id: 1, name: 'Ledger',   coin: 'BTC', address: 'bc1q55th7faa32m8ff4tklyhktnzqc99kq9un3rsqw' },
    { id: 2, name: 'MetaMask', coin: 'ETH', address: '0xcbe2fb57d667f073f749bce4364ceb90bf1bf282' },
    { id: 3, name: 'Phantom',  coin: 'SOL', address: 'QTkpQ7Vc3U827KSxEhBMaL9CaLTQA8TH6pqehYaq8pHE' },
    { id: 4, name: 'Exodus',   coin: 'LTC', address: 'ltc1q6mejunjrrf7q5489de7azj2zyf8gmehmss9azm' },
  ];
  state.skins = [
    { id: 1, name: 'AK-47 | Redline (Field-Tested)',            qty: 2, cost: 48.6,  date: daysAgo(110) },
    { id: 2, name: 'AWP | Asiimov (Field-Tested)',              qty: 1, cost: 92,    date: daysAgo(95) },
    { id: 3, name: 'M4A1-S | Hyper Beast (Minimal Wear)',       qty: 1, cost: 118.4, date: daysAgo(60) },
    { id: 4, name: 'Glock-18 | Water Elemental (Minimal Wear)', qty: 3, cost: 51.75, date: daysAgo(38) },
    { id: 5, name: 'USP-S | Kill Confirmed (Field-Tested)',     qty: 1, cost: 0,     date: daysAgo(17) }, // drop gratis
  ];
  state.walletsOpen = true;
  state.skinsOpen = true;
  state.nextSiteId = state.sites.length + 1;
  state.nextTxId = txId;
  state.nextHoldId = state.holdings.length + 1;
  state.nextStockId = state.stocks.length + 1;
  state.nextWalletId = state.wallets.length + 1;
  state.nextSkinId = state.skins.length + 1;
}

function resetDemo() {
  if (!confirm('¿Reiniciar la demo? Se borran tus cambios y vuelven los datos de ejemplo.')) return;
  clearTimeout(saveTimer);
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  seedDemo();
  render();
  renderCrypto();
  renderStocks();
  renderWallets();
  renderSkins();
  refreshPrices(true);
  refreshStocks();
  refreshSkins();
  showToast('↺ demo reiniciada');
}

// ---- LOAD STATE ----`);
rep(`    const raw = localStorage.getItem(STORAGE_KEY);\n    if (raw) {`,
    `    const raw = localStorage.getItem(STORAGE_KEY);\n    if (!raw) { seedDemo(); return; } // primera visita: datos de ejemplo\n    if (raw) {`);
rep(`    console.warn('No se pudo cargar el estado guardado:', e);\n  }`,
    `    console.warn('No se pudo cargar el estado guardado:', e);\n    if (!state.sites.length) seedDemo();\n  }`);

const left = s.match(/alyax|roobet|bet365/gi);
if (left) throw new Error('quedaron referencias: ' + [...new Set(left)].join(', '));
fs.writeFileSync(dst, s.replace(/\n/g, '\r\n'));
for (const f of ['api/skins.js', 'api/stocks.js', 'api/chain.js', 'activos.js']) {
  fs.copyFileSync(path.join(root, f), path.join(root, 'demo', f));
}
console.log('demo/ actualizada desde index.html');
