# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal finance dashboard (Spanish UI, es-MX locale) deployed on Vercel. There is no build step, no package.json, no dependencies, no tests and no linter: the whole app is plain HTML/CSS/JS.

- `index.html` — the entire frontend (styles, markup and one inline `<script>`).
- `api/skins.js` — a single Vercel serverless function (CommonJS, `module.exports = async (req, res)`), served at `/api/skins`.
- `demo/` — a standalone portfolio copy (`demo/index.html` + `demo/api/skins.js`) deployed as its own Vercel project with Root Directory `demo`. It uses its own localStorage keys (`finanzas_demo_v1`, `finanzas_demo_rates`, `finanzas_demo_currency`), loads sample data via `seedDemo()` when its key is missing, has a "Reiniciar demo" button, and drops the gambling-related wording ("plataforma" instead of "sitio"). It is a copy, not shared code: changes to the main app or `api/skins.js` must be carried over by hand if the demo should get them.

## Running locally

Opening `index.html` directly works for everything except CS2 skin prices, which need the `/api/skins` function. To exercise that locally, use the Vercel CLI from the repo root:

```bash
vercel dev
```

Deploys happen through Vercel's GitHub integration on pushes to `main` (remote: `Alyax0/Dashboard-Alyax`).

## Architecture

**State and persistence.** All user data lives in a single global `state` object, persisted to `localStorage` under `alyax_dashboard_v1` (debounced in `saveState()`, which also shows the "✓ guardado" toast). IDs are monotonically increasing counters stored in state (`nextSiteId`, `nextTxId`, `nextHoldId`, `nextWalletId`, `nextSkinId`). When adding a new field to state, update **both** `loadState()` (with a default) and the explicit object literal in `saveState()` — fields are listed by hand, not spread. Exchange rates and the chosen display currency are stored separately under `alyax_rates` and `alyax_currency`. Live prices (`prices`, `ticker`) are in-memory only.

**Rendering.** No framework: each section has a `render*()` function that rebuilds its container's `innerHTML` from template strings (`render()` for sites/transactions plus `renderCrypto`, `renderWallets`, `renderSkins`, `renderTicker`). Event handlers are inline `onclick="fn(id)"` attributes, so handler functions must be globals. Escape user text with `escHtml()` when interpolating. The usual mutation pattern is: change `state` → call the relevant `render*()` → `saveState()`.

**Sections:**
- *Sites* (`state.sites[].txs[]`): deposits (`dep`) / withdrawals (`ret`) per site; summary cards are computed in `updateSummary()`.
- *Crypto holdings* (`state.holdings`): one row per coin (`mergeInto` / `subtractFrom` keep it that way). Supported coins are the `COINS` array, keyed by CoinGecko id. `renderCrypto()` also draws the SVG donut (`renderDonut` / `setDonutActive`): share of current value per coin, max 6 segments (the smallest fold into a gray "Otras"), colors from the dark-mode validated categorical palette in `DONUT_COLORS`, assigned in `COINS` order so a coin keeps its color as prices move.
- *Últimos movimientos*: `renderRecent()` (called at the end of `render()`) lists all sites' transactions newest first, 10 at a time (`showMoreRecent`); on phones the rows become stacked cards via CSS.
- *Wallets* (`state.wallets`): saved public addresses.
- *CS2 skins* (`state.skins`): priced via `/api/skins`.
- *Ticker* sidebar: live prices + 24h change for all `COINS`.

**Cross-section automation.** In `addTx()`, if a transaction's note starts with a coin symbol/id/name (`coinFromNote`, e.g. "ltc"), a withdrawal adds that USD amount of the coin to holdings and a deposit subtracts it. The link is recorded on the transaction as `tx.crypto`, and `deleteTx()` reverses it via `undoCrypto()`. Keep this round-trip consistent when touching either side.

**External data sources (all called from the browser except Skinport):**
- CoinGecko `simple/price` — holdings and ticker (`refreshPrices` every 60 s and on tab focus; it also triggers `refreshFx` and `refreshTicker`, which self-throttles to 30 s).
- open.er-api.com, falling back to the jsDelivr-hosted `@fawazahmed0/currency-api` (both keyless and include ARS/PEN/COP/CLP; Frankfurter does not) — USD→display-currency rates, cached in localStorage for 6 h (`RATES_KEY`), with the last saved rates used if both fail.
- Skinport, via `api/skins.js` — `?q=` returns up to 12 name suggestions, `?names=` takes newline-separated names (not `|`, which every skin name already contains) and returns `{ prices: { name: { min, sug } } }`. Skinport rate-limits (8 req / 5 min), so the function caches the full item list in memory for 5 min and falls back to the stale cache on errors; the frontend refreshes skins every 5 min.

**Display currency.** All amounts are stored in USD; the header selector (`setCurrency`, saved under `CURRENCY_KEY`) only changes display. Format money through `fmt` / `fmtUnit` (convert to the selected currency) and add the small USD reference with `usdHtml` / `usdTxt` / `usdRef` (empty when the currency is USD). The live-price ticker stays in USD and uses `fmtPrice`. Form inputs are still entered in USD.

**Tabs.** Both the dashboard and the demo split the page into `#tab-finanzas` and `#tab-skins` panels, switched by `showTab()`; `#skins` in the URL opens the skins tab. The ticker sits outside both panels.
