import {
  demoInvestments,
  demoSummary,
  getChartData,
} from '../../../services/investment-service';

import type { InvestmentSheetsData } from '../../../services/google-sheets.service';
import type { DashboardData } from '../dashboard.types';
import type { ChartPoint, PerformancePeriod } from '../../../types/portfolio';

function filterHistory(
  points: ChartPoint[],
  period: PerformancePeriod,
): ChartPoint[] {
  if (period === 'ALL') {
    return points;
  }

  const daysByPeriod: Record<Exclude<PerformancePeriod, 'ALL'>, number> = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '1Y': 365,
  };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysByPeriod[period]);

  const cutoffKey = [
    cutoff.getFullYear(),
    String(cutoff.getMonth() + 1).padStart(2, '0'),
    String(cutoff.getDate()).padStart(2, '0'),
  ].join('-');

  return points.filter((point) => {
    const date = point.date ?? point.label;
    return date >= cutoffKey;
  });
}

export function getDashboardData(
  period: PerformancePeriod,
  connectedData?: InvestmentSheetsData,
): DashboardData {
  if (!connectedData) {
    return {
      summary: demoSummary,
      investments: demoInvestments,
      chartPoints: getChartData(period),
      period,
      source: 'demo',
    };
  }

  return {
    summary: connectedData.summary,
    investments: connectedData.investments,
    chartPoints: filterHistory(connectedData.historyPoints, period),
    period,
    source: 'google-sheets',
  };
}