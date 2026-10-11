type LogoCategory = 'ticker' | 'bank';

const LOGO_TICKER: Record<string, string> = {
  NVDA: 'nvda.svg',
  AAPL: 'aapl.svg',
  MSFT: 'msft.svg',
  GOOGL: 'googl.svg',
  GOOG: 'googl.svg',
  META: 'meta.svg',
  BTC: 'btc.svg',
  VOO: 'voo.svg',
  WALMEX: 'walmex.svg',
  AMZN: 'amzn.svg',
  TSLA: 'tsla.svg',
  NFLX: 'nflx.svg',
  IVVPESOISHRS: 'ivvpesoishrs.svg',
  MU: 'mu.svg',
  VST: 'vst.svg',
  AVGO: 'avgo.svg',
  QQQ: 'qqq.svg',
};

const LOGO_BANK: Record<string, string> = {
  MIFEL: 'mifel.svg',
  SANTANDER: 'santander.svg',
  BBVA: 'bbva.svg',
  HSBC: 'hsbc.svg',
  BANORTE: 'banorte.svg',
  CITIBANAMEX: 'citibanamex.svg',
  INBURSA: 'inbursa.svg',
  OPENBANK: 'openbank.svg',
  NU: 'nu.svg',
  DIDI: 'didi.svg',
  FINSUS: 'finsus.svg',
  STORI: 'stori.svg',
};

export function getAssetLogoPath(
  symbol: string,
  category: LogoCategory = 'ticker',
): string {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const logoFiles = category === 'bank' ? LOGO_BANK : LOGO_TICKER;
  const folder = category === 'bank' ? 'banking' : 'holdings';

  const fileName = logoFiles[normalizedSymbol] ?? 'default.svg';

  return `${import.meta.env.BASE_URL}logos/${folder}/${fileName}`;
}

export function getDefaultAssetLogoPath(): string {
  return `${import.meta.env.BASE_URL}logos/default.svg`;
}