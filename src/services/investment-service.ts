
import type {
  Investment,
  Currency,
} from '../types/investment';

import type { Transaction } from '../types/transaction';

import type {
  ChartPoint,
  PortfolioSummary,
  PerformancePeriod,
} from '../types/portfolio';

import { convertCurrency } from '../utils/currency';

const PORTFOLIO_CURRENCY: Currency = 'MXN';

/**
 * Datos de demostración de inversiones.
 * Los precios no representan cotizaciones reales.
 */
export const demoInvestments: Investment[] = [
  {
    id: '1',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    assetType: 'stock',
    currency: 'USD',
    quantity: 8,
    averageCost: 125,
    currentPrice: 180,
  },
  {
    id: '2',
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    assetType: 'etf',
    currency: 'USD',
    quantity: 12,
    averageCost: 480,
    currentPrice: 530,
  },
  {
    id: '3',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    assetType: 'stock',
    currency: 'USD',
    quantity: 10,
    averageCost: 165,
    currentPrice: 190,
  },
  {
    id: '4',
    symbol: 'BTC',
    name: 'Bitcoin',
    assetType: 'crypto',
    currency: 'USD',
    quantity: 0.025,
    averageCost: 95000,
    currentPrice: 110000,
  },
];

/**
 * Transacciones de demostración.
 */
export const demoTransactions: Transaction[] = [
  {
    id: 't1',
    symbol: 'VOO',
    type: 'buy',
    quantity: 2,
    price: 530,
    currency: 'USD',
    date: '2026-10-08',
  },
  {
    id: 't2',
    symbol: 'NVDA',
    type: 'dividend',
    quantity: 1,
    price: 2.4,
    currency: 'USD',
    date: '2026-10-05',
  },
  {
    id: 't3',
    symbol: 'GOOGL',
    type: 'buy',
    quantity: 1,
    price: 190,
    currency: 'USD',
    date: '2026-10-02',
  },
];

/**
 * Calcula el resumen del portafolio en MXN.
 */
function calculateDemoSummary(): PortfolioSummary {
  const totals = demoInvestments.reduce(
    (result, investment) => {
      const marketValue =
        investment.quantity * investment.currentPrice;

      const investedValue =
        investment.quantity * investment.averageCost;

      result.totalValue += convertCurrency(
        marketValue,
        investment.currency,
        PORTFOLIO_CURRENCY,
      );

      result.invested += convertCurrency(
        investedValue,
        investment.currency,
        PORTFOLIO_CURRENCY,
      );

      return result;
    },
    {
      totalValue: 0,
      invested: 0,
    },
  );

  return {
    totalValue: totals.totalValue,
    invested: totals.invested,
    totalGain: totals.totalValue - totals.invested,
    dailyChange: 1.24,
    currency: PORTFOLIO_CURRENCY,
  };
}

export const demoSummary = calculateDemoSummary();

/**
 * Historial sintético para la gráfica del portafolio.
 */
const chartData: Record<PerformancePeriod, ChartPoint[]> = {
  '1W': [
    { label: 'Lun', value: 239000 },
    { label: 'Mar', value: 241500 },
    { label: 'Mié', value: 240200 },
    { label: 'Jue', value: 244000 },
    { label: 'Vie', value: 242800 },
    { label: 'Sáb', value: 246100 },
    { label: 'Dom', value: 248650 },
  ],

  '1M': [
    { label: '10 sep', value: 225000 },
    { label: '15 sep', value: 231000 },
    { label: '20 sep', value: 228500 },
    { label: '25 sep', value: 238000 },
    { label: '30 sep', value: 234500 },
    { label: '5 oct', value: 242000 },
    { label: '9 oct', value: 248650 },
  ],

  '3M': [
    { label: 'Jul', value: 210000 },
    { label: 'Jul', value: 219000 },
    { label: 'Ago', value: 215000 },
    { label: 'Ago', value: 229000 },
    { label: 'Sep', value: 232000 },
    { label: 'Sep', value: 239000 },
    { label: 'Oct', value: 248650 },
  ],

  '1Y': [
    { label: 'Nov', value: 180000 },
    { label: 'Ene', value: 194000 },
    { label: 'Mar', value: 188000 },
    { label: 'May', value: 210000 },
    { label: 'Jul', value: 222000 },
    { label: 'Sep', value: 235000 },
    { label: 'Oct', value: 248650 },
  ],

  ALL: [
    { label: '2023', value: 100000 },
    { label: '2024', value: 142000 },
    { label: 'Ene', value: 160000 },
    { label: 'Abr', value: 175000 },
    { label: 'Jul', value: 210000 },
    { label: 'Sep', value: 230000 },
    { label: 'Oct', value: 248650 },
  ],
};

/**
 * Ajusta los puntos para que el último coincida con
 * el valor actual del resumen.
 *
 * Los puntos son datos de demostración, no históricos reales.
 */
export function getChartData(
  period: PerformancePeriod,
): ChartPoint[] {
  const points = chartData[period];
  const lastValue = points[points.length - 1]?.value ?? 0;

  if (lastValue === 0) {
    return points;
  }

  const scale = demoSummary.totalValue / lastValue;

  return points.map((point) => ({
    ...point,
    value: point.value * scale,
  }));
}
