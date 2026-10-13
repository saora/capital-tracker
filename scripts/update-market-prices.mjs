import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'public/data/market-prices.json');

const YAHOO_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart/';

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 CapitalTracker/1.0',
  Accept: 'application/json',
};

const SYMBOLS = {
  META: ['META'],
  VOO: ['VOO'],
  QQQ: ['QQQ'],
  MSFT: ['MSFT'],
  GOOG: ['GOOG', 'GOOGL'],
  NVDA: ['NVDA'],
  MU: ['MU'],
  AAPL: ['AAPL'],
  AMZN: ['AMZN'],
  VST: ['VST'],
  AVGO: ['AVGO'],
  TSLA: ['TSLA'],
  WALMEX: ['WALMEX.MX'],
  IVVPESOISHRS: ['IVVPESOISHRS.MX', 'IVVPESOISHRS'],
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al consultar ${url}`);
  }

  return response.json();
}

async function getYahooQuote(providerSymbol) {
  const url =
    `${YAHOO_URL}${encodeURIComponent(providerSymbol)}` +
    '?range=5d&interval=1d';

  const data = await fetchJson(url, {
    headers: REQUEST_HEADERS,
  });

  const result = data.chart?.result?.[0];

  if (!result) {
    throw new Error(
      data.chart?.error?.description ?? 'No se recibió una cotización',
    );
  }

  const meta = result.meta ?? {};
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  const rawPreviousClose = Number(meta.chartPreviousClose);
  const previousClose =
    Number.isFinite(rawPreviousClose) && rawPreviousClose > 0
      ? rawPreviousClose
      : null;

  let price = Number(meta.regularMarketPrice);

  if (!Number.isFinite(price) || price <= 0) {
    const lastClose = [...closes]
      .reverse()
      .find((value) => Number.isFinite(value) && value > 0);

    price = lastClose;
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('El proveedor no devolvió un precio válido');
  }

  const timestamp = Number(meta.regularMarketTime);

  const dailyChangePercent =
    previousClose !== null
      ? ((price - previousClose) / previousClose) * 100
      : null;

  return {
    providerSymbol,
    price,
    previousClose,
    dailyChangePercent,
    currency: meta.currency ?? null,
    timestamp:
      timestamp > 0
        ? new Date(timestamp * 1000).toISOString()
        : null,
  };
}

async function getUsdMxnRate() {
  const quote = await getYahooQuote('MXN=X');

  if (quote.currency && quote.currency !== 'MXN') {
    throw new Error(
      `Moneda inesperada para USD/MXN: ${quote.currency}`,
    );
  }

  return quote.price;
}

async function getBitcoinMxn() {
  const headers = {
    Accept: 'application/json',
  };

  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  }

  const data = await fetchJson(
    'https://api.coingecko.com/api/v3/simple/price' +
    '?ids=bitcoin&vs_currencies=mxn&include_24hr_change=true',
    { headers },
  );

  const price = Number(data.bitcoin?.mxn);
  const rawChange = data.bitcoin?.mxn_24h_change;
  const dailyChangePercent =
    typeof rawChange === 'number' && Number.isFinite(rawChange)
      ? rawChange
      : null;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('CoinGecko no devolvió un precio válido para BTC');
  }

  return {
    price,
    dailyChangePercent,
  };
}

async function getAssetPrice(symbol, candidates, usdMxn) {
  const errors = [];

  for (const providerSymbol of candidates) {
    try {
      const quote = await getYahooQuote(providerSymbol);

      if (!quote.currency) {
        throw new Error('No se identificó la moneda de la cotización');
      }

      let priceMXN = null;

      if (quote.currency === 'MXN') {
        priceMXN = quote.price;
      } else if (quote.currency === 'USD' && usdMxn) {
        priceMXN = quote.price * usdMxn;
      }

      return {
        symbol,
        providerSymbol: quote.providerSymbol,
        price: quote.price,
        previousClose: quote.previousClose,
        dailyChangePercent: quote.dailyChangePercent,
        currency: quote.currency,
        priceMXN,
        timestamp: quote.timestamp,
        source: 'Yahoo Finance (endpoint no oficial)',
        status: priceMXN === null ? 'missing-fx' : 'ok',
      };
    } catch (error) {
      errors.push(
        `${providerSymbol}: ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    symbol,
    providerSymbol: null,
    price: null,
    previousClose: null,
    dailyChangePercent: null,
    currency: null,
    priceMXN: null,
    timestamp: null,
    source: 'Yahoo Finance (endpoint no oficial)',
    status: 'unavailable',
    error: errors.join(' | '),
  };
}

async function main() {
  const updatedAt = new Date().toISOString();
  const errors = [];
  const prices = {};

  let usdMxn = null;

  try {
    usdMxn = await getUsdMxnRate();
    console.log(`USD/MXN: ${usdMxn}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    errors.push(`USD/MXN: ${message}`);
    console.error('No se pudo obtener USD/MXN:', message);
  }

  for (const [symbol, candidates] of Object.entries(SYMBOLS)) {
    prices[symbol] = await getAssetPrice(
      symbol,
      candidates,
      usdMxn,
    );

    const quote = prices[symbol];

    if (quote.status !== 'ok') {
      errors.push(`${symbol}: ${quote.error ?? quote.status}`);
    }

    console.log(
      `${symbol}:`,
      quote.priceMXN === null
        ? quote.status
        : `MXN ${quote.priceMXN.toFixed(2)} | variación diaria ${quote.dailyChangePercent === null
          ? 'N/D'
          : `${quote.dailyChangePercent.toFixed(2)}%`
        }`,
    );
  }

  try {
    const btcQuote = await getBitcoinMxn();

    prices.BTC = {
      symbol: 'BTC',
      providerSymbol: 'bitcoin',
      price: btcQuote.price,
      previousClose: null,
      dailyChangePercent: btcQuote.dailyChangePercent,
      currency: 'MXN',
      priceMXN: btcQuote.price,
      timestamp: new Date().toISOString(),
      source: 'CoinGecko',
      status: 'ok',
    };

    console.log(
      `BTC: MXN ${btcQuote.price.toFixed(2)} | variación 24 h ${btcQuote.dailyChangePercent === null
        ? 'N/D'
        : `${btcQuote.dailyChangePercent.toFixed(2)}%`
      }`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    prices.BTC = {
      symbol: 'BTC',
      providerSymbol: 'bitcoin',
      price: null,
      previousClose: null,
      dailyChangePercent: null,
      currency: 'MXN',
      priceMXN: null,
      timestamp: null,
      source: 'CoinGecko',
      status: 'unavailable',
      error: message,
    };

    errors.push(`BTC: ${message}`);
    console.error('No se pudo obtener BTC:', message);
  }

  const output = {
    updatedAt,
    baseCurrency: 'MXN',
    exchangeRate: {
      USD_MXN: usdMxn,
      source: 'Yahoo Finance (endpoint no oficial)',
    },
    prices,
    errors,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(
    OUTPUT,
    `${JSON.stringify(output, null, 2)}\n`,
  );

  console.log(`\nArchivo generado: ${OUTPUT}`);
  console.log(`Errores detectados: ${errors.length}`);
}

main().catch((error) => {
  console.error('Error al generar los precios:', error);
  process.exitCode = 1;
});