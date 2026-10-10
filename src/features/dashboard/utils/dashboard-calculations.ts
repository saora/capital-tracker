import type { Investment } from '../../../types/investment';
import type { ChartPoint } from '../../../types/portfolio';

export interface HoldingMetrics {
  marketValue: number;
  investedValue: number;
  gain: number;
  gainPercent: number;
}

export interface PerformanceMetrics {
  change: number;
  changePercent: number;
}

export function calculateHoldingMetrics(
  investment: Investment,
): HoldingMetrics {
  const marketValue =
    investment.quantity * investment.currentPrice;

  const investedValue =
    investment.quantity * investment.averageCost;

  const gain = marketValue - investedValue;

  const gainPercent = investedValue > 0
    ? (gain / investedValue) * 100
    : 0;

  return {
    marketValue,
    investedValue,
    gain,
    gainPercent,
  };
}

export function calculatePerformance(
  points: ChartPoint[],
): PerformanceMetrics {
  const firstValue = points[0]?.value ?? 0;
  const lastValue = points[points.length - 1]?.value ?? 0;

  const change = lastValue - firstValue;

  const changePercent = firstValue !== 0
    ? (change / firstValue) * 100
    : 0;

  return {
    change,
    changePercent,
  };
}