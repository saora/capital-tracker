
import type { Currency } from './investment';

export type PerformancePeriod = '1W' | '1M' | '3M' | '1Y' | 'ALL';

export interface PortfolioSummary {
  totalValue: number;
  invested: number;
  totalGain: number;
  dailyChange: number;
  currency: Currency;
}

export interface AssetAllocation {
  assetType: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export interface ChartPoint {
  label: string;
  value: number;
  date?: string;
}

export interface PortfolioPerformance {
  period: PerformancePeriod;
  points: ChartPoint[];
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
}
