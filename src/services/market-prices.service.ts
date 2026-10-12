export interface MarketPrice {
  symbol: string;
  providerSymbol: string | null;
  price: number | null;
  previousClose?: number | null;
  dailyChangePercent?: number | null;
  currency: string | null;
  priceMXN: number | null;
  timestamp: string | null;
  source: string;
  status: 'ok' | 'missing-fx' | 'unavailable';
  error?: string;
}

interface MarketPricesResponse {
  updatedAt: string;
  baseCurrency: 'MXN';
  exchangeRate: {
    USD_MXN: number | null;
    source: string;
  };
  prices: Record<string, MarketPrice>;
  errors: string[];
}

export async function getMarketPrices(): Promise<
  Record<string, MarketPrice>
> {
  const url = `${import.meta.env.BASE_URL}data/market-prices.json`;

  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `No se pudo leer el archivo de precios: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as MarketPricesResponse;

  if (!data.prices || typeof data.prices !== 'object') {
    throw new Error('El archivo de precios no tiene un formato válido.');
  }

  return data.prices;
}