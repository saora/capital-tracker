import type { Investment } from '../../types/investment';

import type {
  PortfolioSummary,
  PerformancePeriod,
  ChartPoint,
} from '../../types/portfolio';

export interface DashboardData {
  summary: PortfolioSummary;
  investments: Investment[];
  chartPoints: ChartPoint[];
  period: PerformancePeriod;
  source: 'demo' | 'google-sheets';
}

export interface DashboardViewModel {
  greeting: string;
  balanceCardHtml: string;
  metricsGridHtml: string;
  performanceChartHtml: string;
  holdingsListHtml: string;
  disclaimer: string;
}