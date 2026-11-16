// Lista curada de la pestaña "Explorar activos", ordenada por popularidad:
// el primero de la lista sale primero. Para editarla, agrega, quita o mueve líneas.
//
//   tipo:   'accion' | 'etf' | 'cripto'
//   ticker: ticker de EE. UU. (acciones y ETFs) o símbolo de la cripto
//   nombre: nombre que se ve en la tarjeta
//   desc:   sector o descripción corta
//   coin:   solo cripto: id de CoinGecko. Tiene que estar en la lista COINS de
//           index.html para poder agregarla a la sección Cripto.
window.ACTIVOS = [
  { tipo: 'cripto', ticker: 'BTC',   nombre: 'Bitcoin',              desc: 'Criptomoneda',            coin: 'bitcoin' },
  { tipo: 'accion', ticker: 'AAPL',  nombre: 'Apple',                desc: 'Tecnología' },
  { tipo: 'accion', ticker: 'NVDA',  nombre: 'NVIDIA',               desc: 'Semiconductores' },
  { tipo: 'etf',    ticker: 'VOO',   nombre: 'Vanguard S&P 500',     desc: 'Vanguard · EE. UU.' },
  { tipo: 'cripto', ticker: 'ETH',   nombre: 'Ethereum',             desc: 'Contratos inteligentes',  coin: 'ethereum' },
  { tipo: 'accion', ticker: 'TSLA',  nombre: 'Tesla',                desc: 'Autos eléctricos' },
  { tipo: 'accion', ticker: 'MSFT',  nombre: 'Microsoft',            desc: 'Software y nube' },
  { tipo: 'etf',    ticker: 'QQQ',   nombre: 'Invesco QQQ',          desc: 'Nasdaq 100' },
  { tipo: 'accion', ticker: 'AMZN',  nombre: 'Amazon',               desc: 'Comercio electrónico' },
  { tipo: 'etf',    ticker: 'SPY',   nombre: 'SPDR S&P 500',         desc: 'State Street · EE. UU.' },
  { tipo: 'cripto', ticker: 'SOL',   nombre: 'Solana',               desc: 'Blockchain',              coin: 'solana' },
  { tipo: 'accion', ticker: 'GOOGL', nombre: 'Alphabet',             desc: 'Internet y publicidad' },
  { tipo: 'accion', ticker: 'META',  nombre: 'Meta Platforms',       desc: 'Redes sociales' },
  { tipo: 'cripto', ticker: 'XRP',   nombre: 'XRP',                  desc: 'Pagos internacionales',   coin: 'ripple' },
  { tipo: 'etf',    ticker: 'VTI',   nombre: 'Vanguard Total Stock', desc: 'Mercado total EE. UU.' },
  { tipo: 'accion', ticker: 'MELI',  nombre: 'MercadoLibre',         desc: 'Comercio electrónico' },
  { tipo: 'accion', ticker: 'NFLX',  nombre: 'Netflix',              desc: 'Streaming' },
  { tipo: 'accion', ticker: 'AMD',   nombre: 'AMD',                  desc: 'Semiconductores' },
  { tipo: 'accion', ticker: 'PLTR',  nombre: 'Palantir',             desc: 'Software de datos' },
  { tipo: 'cripto', ticker: 'DOGE',  nombre: 'Dogecoin',             desc: 'Memecoin',                coin: 'dogecoin' },
  { tipo: 'accion', ticker: 'BRK.B', nombre: 'Berkshire Hathaway',   desc: 'Holding diversificado' },
  { tipo: 'etf',    ticker: 'IBIT',  nombre: 'iShares Bitcoin Trust', desc: 'Bitcoin al contado' },
  { tipo: 'accion', ticker: 'JPM',   nombre: 'JPMorgan Chase',       desc: 'Banca' },
  { tipo: 'accion', ticker: 'V',     nombre: 'Visa',                 desc: 'Pagos' },
  { tipo: 'etf',    ticker: 'SCHD',  nombre: 'Schwab US Dividend',   desc: 'Dividendos' },
  { tipo: 'etf',    ticker: 'VT',    nombre: 'Vanguard Total World', desc: 'Mercado mundial' },
  { tipo: 'cripto', ticker: 'BNB',   nombre: 'BNB',                  desc: 'Ecosistema Binance',      coin: 'binancecoin' },
  { tipo: 'etf',    ticker: 'GLD',   nombre: 'SPDR Gold Shares',     desc: 'Oro' },
  { tipo: 'accion', ticker: 'NU',    nombre: 'Nu Holdings',          desc: 'Banca digital' },
  { tipo: 'accion', ticker: 'COIN',  nombre: 'Coinbase',             desc: 'Exchange cripto' },
  { tipo: 'accion', ticker: 'KO',    nombre: 'Coca-Cola',            desc: 'Bebidas' },
  { tipo: 'accion', ticker: 'DIS',   nombre: 'Disney',               desc: 'Entretenimiento' },
  { tipo: 'cripto', ticker: 'ADA',   nombre: 'Cardano',              desc: 'Blockchain',              coin: 'cardano' },
  { tipo: 'cripto', ticker: 'TRX',   nombre: 'TRON',                 desc: 'Blockchain',              coin: 'tron' },
  { tipo: 'cripto', ticker: 'LTC',   nombre: 'Litecoin',             desc: 'Pagos',                   coin: 'litecoin' },
  { tipo: 'cripto', ticker: 'TON',   nombre: 'Toncoin',              desc: 'Blockchain de Telegram',  coin: 'the-open-network' },
  { tipo: 'cripto', ticker: 'XMR',   nombre: 'Monero',               desc: 'Privacidad',              coin: 'monero' },
  { tipo: 'cripto', ticker: 'BCH',   nombre: 'Bitcoin Cash',         desc: 'Pagos',                   coin: 'bitcoin-cash' },
  { tipo: 'cripto', ticker: 'USDT',  nombre: 'Tether',               desc: 'Stablecoin (USD)',        coin: 'tether' },
  { tipo: 'cripto', ticker: 'USDC',  nombre: 'USD Coin',             desc: 'Stablecoin (USD)',        coin: 'usd-coin' },
];
