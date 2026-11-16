# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal finance dashboard (Spanish UI, es-MX locale) deployed on Vercel. There is no build step, no package.json, no dependencies, no tests and no linter: the whole app is plain HTML/CSS/JS.

- `index.html` — the entire frontend (styles, markup and one inline `<script>`).
- `api/skins.js`, `api/stocks.js` — Vercel serverless functions (CommonJS, `module.exports = async (req, res)`), served at `/api/skins` and `/api/stocks`. `api/stocks.js` needs the `FINNHUB_API_KEY` environment variable (set in Vercel → Settings → Environment Variables; never commit it) and returns a 500 with a clear message when it is missing.
- `activos.js` — the curated list for the "Explorar activos" tab (`window.ACTIVOS`, ordered by popularity), loaded with a plain `<script>` before the main one. Crypto entries need a `coin` id that exists in `COINS`, or they can't be added to Cripto.
- `demo/` — a standalone portfolio copy (`demo/index.html` + `demo/api/skins.js`, which still prices skins from Skinport while the main app uses CSFloat) deployed as its own Vercel project with Root Directory `demo`. It uses its own localStorage keys (`finanzas_demo_v1`, `finanzas_demo_rates`, `finanzas_demo_currency`), loads sample data via `seedDemo()` when its key is missing, has a "Reiniciar demo" button, and drops the gambling-related wording ("plataforma" instead of "sitio"). It is a copy, not shared code: changes to the main app or `api/skins.js` must be carried over by hand if the demo should get them.

## Running locally

Opening `index.html` directly works for everything except CS2 skin prices, which need the `/api/skins` function. To exercise that locally, use the Vercel CLI from the repo root:

```bash
vercel dev
```

Deploys happen through Vercel's GitHub integration on pushes to `main` (remote: `Alyax0/Dashboard-Alyax`).

## Architecture

**State and persistence.** All user data lives in a single global `state` object, persisted to `localStorage` under `alyax_dashboard_v1` (debounced in `saveState()`, which also shows the "✓ guardado" toast). IDs are monotonically increasing counters stored in state (`nextSiteId`, `nextTxId`, `nextHoldId`, `nextWalletId`, `nextSkinId`). When adding a new field to state, update **both** `loadState()` (with a default) and the explicit object literal in `saveState()` — fields are listed by hand, not spread. Exchange rates and the chosen display currency are stored separately under `alyax_rates` and `alyax_currency`. Live prices (`prices`, `ticker`) are in-memory only.

**Look and theme.** GBM-inspired: light theme by default (gray `--bg`, white cards with `--shadow`, pill buttons in `--accent`), with a dark theme under `:root[data-theme="dark"]` toggled by the moon/sun button in the top bar (`toggleTheme()`, saved under `alyax_theme`; a tiny inline script in `<head>` applies it before paint). All colors go through the CSS variables, including `--hover`, `--backdrop` and `--option-bg`, so never hard-code dark-only colors. Text colors in both themes pass 4.5:1. The page is a single 720px column under a sticky `.topbar` (logo, tabs with icons, currency selector, theme button); there are no fixed side columns.

**Rendering.** No framework: each section has a `render*()` function that rebuilds its container's `innerHTML` from template strings (`render()` for sites/transactions plus `renderCrypto`, `renderWallets`, `renderSkins`, `renderTicker`). Event handlers are inline `onclick="fn(id)"` attributes, so handler functions must be globals. Escape user text with `escHtml()` when interpolating. The usual mutation pattern is: change `state` → call the relevant `render*()` → `saveState()`.

**Sections:**
- *Patrimonio total / Tus inversiones* (top of Finanzas): `renderHero()` sums current value of Cripto + Acciones + Skins (invested when there is no price) and is called at the end of `renderCrypto`, `renderStocks` and `renderSkins`. The quick-access card has category buttons (`goSection`, `openExploreFilter`, `showTab`) and `renderQuickPop()` shows the first 8 entries of `activos.js`, opening their sheet.
- *Sites* (`state.sites[].txs[]`): deposits (`dep`) / withdrawals (`ret`) per site; summary cards are computed in `updateSummary()`.
- *Crypto holdings* (`state.holdings`): one row per coin (`mergeInto` / `subtractFrom` keep it that way). Supported coins are the `COINS` array, keyed by CoinGecko id. `renderCrypto()` also draws the SVG donut (`renderDonut` / `setDonutActive`): share of current value per coin, max 6 segments (the smallest fold into a gray "Otras"), colors from the validated categorical palette in `DONUT_PALETTE` (light and dark steps, picked by `donutTheme()`), assigned in `COINS` order so a coin keeps its color as prices move.
- *Últimos movimientos*: `renderRecent()` (called at the end of `render()`) lists all sites' transactions newest first, 10 at a time (`showMoreRecent`). It sits at the end of the Finanzas tab; on phones the rows become stacked cards via CSS.
- *Acciones* (`state.stocks`: `{ symbol, name, qty, cost }`, one row per ticker): `renderStocks()` / `refreshStocks()` (every 3 min) with quotes from `/api/stocks` in `stockQuotes`; "Hoy" is the day change (`change × qty`). The donut code is shared: `createDonut(prefix)` builds one per section (`''` for Cripto, `'st-'` for Acciones) and `foldSlices()` caps segments and assigns colors.
- *Explorar activos* (no state of its own): `renderExplore()` filters `activos.js` by chip and search text, and the search also asks `/api/stocks?q=` for US stocks/ETFs not in the list. `openAsset()` opens a sheet with price (stocks via `/api/stocks`, crypto from `ticker`), a 1-month SVG chart (`/api/stocks?history=`) and "Agregar a mi portfolio", which fills and calls the existing `addStock()` / `addHolding()` forms. Logos load from financialmodelingprep.com (stocks/ETFs) and the `cryptocurrency-icons` package on jsDelivr, falling back to the initial.
- *Wallets* (`state.wallets`): saved public addresses.
- *CS2 skins* (`state.skins`): priced via `/api/skins`.
- *Precios en vivo* card (`#ticker`, inside Finanzas): live prices + 24h change for `COINS` except the stablecoins in `STABLES` (still fetched, since holdings take their prices from `ticker`).

**Cross-section automation.** In `addTx()`, if a transaction's note starts with a coin symbol/id/name (`coinFromNote`, e.g. "ltc"), a withdrawal adds that USD amount of the coin to holdings and a deposit subtracts it. The link is recorded on the transaction as `tx.crypto`, and `deleteTx()` reverses it via `undoCrypto()`. Keep this round-trip consistent when touching either side.

**External data sources (all called from the browser except Skinport):**
- CoinGecko `simple/price` — the free API rate-limits per IP (429, which the browser reports as a CORS error), so keep requests to a minimum. `refreshPrices` (every 60 s and on tab focus) makes a single request through `refreshTicker` (all `COINS`, self-throttled to 30 s, no fast retry on failure) and copies holdings' prices from `ticker`. Adding a holding or a coin-tagged transaction goes through `getPrice()`: ticker price if < 2 min old, else one request, else the last ticker price if < 15 min old.
- open.er-api.com, falling back to the jsDelivr-hosted `@fawazahmed0/currency-api` (both keyless and include ARS/PEN/COP/CLP; Frankfurter does not) — USD→display-currency rates, cached in localStorage for 6 h (`RATES_KEY`), with the last saved rates used if both fail.
- CSFloat, via `api/skins.js` — `?q=` returns up to 12 name suggestions, `?names=` takes newline-separated names (not `|`, which every skin name already contains) and returns `{ prices: { name: { min, sug } } }` plus `source`. Prices come from CSFloat's public, keyless price list (`csfloat.com/api/v1/listings/price-list`: `[{ market_hash_name, quantity, min_price }]`, cents), i.e. the lowest listing; if it fails, CSGO Trader's hourly copy (`prices.csgotrader.app/latest/csfloat.json`) is used. The whole list is cached in memory for 5 min, with the stale cache as a last resort; requests use `https.get` with manual Brotli/gzip decoding. Skinport was dropped because it rejects requests from Vercel's servers with a 406 whatever headers are sent (it works from a home connection, so local tests pass). The demo's `demo/api/skins.js` still uses Skinport with CSGO Trader's Skinport copy as fallback.

- Finnhub, via `api/stocks.js` — `?q=` returns up to 10 US tickers (stocks/ETFs; foreign-exchange suffixes filtered out), `?symbols=AAPL,VOO` returns `{ quotes: { AAPL: { price, change, changePct, prevClose } } }`; unknown tickers are omitted. Free plan is 60 req/min, so quotes are cached in memory for 3 min and searches for a day; the key goes in the `X-Finnhub-Token` header. `?history=TICKER` (Yahoo Finance chart endpoint, unofficial, no key) and `?history=<coingecko id>&kind=crypto` (CoinGecko market_chart) return `{ points: [[ms, price], ...] }` for the last month, cached 1 h; this branch runs before the Finnhub key check.

**Display currency.** All amounts are stored in USD; the header selector (`setCurrency`, saved under `CURRENCY_KEY`) only changes display. Format money through `fmt` / `fmtUnit` (convert to the selected currency) and add the small USD reference with `usdHtml` / `usdTxt` / `usdRef` (empty when the currency is USD). The live-price ticker stays in USD and uses `fmtPrice`. Form inputs are still entered in USD.

**Tabs.** The dashboard splits the page into `#tab-finanzas`, `#tab-skins`, `#tab-acciones` and `#tab-explorar` panels (the demo has only Finanzas and Skins), switched by `showTab()` over the `TABS` list; `#acciones` / `#skins` / `#explorar` in the URL open those tabs, and the tab bar scrolls sideways on phones. The live-prices card is part of Finanzas.
