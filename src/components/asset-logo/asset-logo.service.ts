
const LOGO_FILES: Record<string, string> = {
  NVDA: 'nvda.svg',
  AAPL: 'aapl.svg',
  MSFT: 'msft.svg',
  GOOGL: 'googl.svg',
  GOOG: 'googl.svg',
  META: 'meta.svg',
  BTC: 'btc.svg',
  VOO: 'voo.svg',
};

export function getAssetLogoPath(symbol: string): string {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const fileName = LOGO_FILES[normalizedSymbol] ?? 'default.svg';

  return `${import.meta.env.BASE_URL}/logos/${fileName}`;
}

export function getDefaultAssetLogoPath(): string {
  return `${import.meta.env.BASE_URL}logos/default.svg`;
}
