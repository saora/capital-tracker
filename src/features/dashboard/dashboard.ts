
import type { PerformancePeriod } from '../../types/portfolio';
import type { InvestmentSheetsData } from '../../services/google-sheets.service';

import { getDashboardData } from './services/dashboard.service';
import { presentDashboard } from './dashboard.presenter';
import { renderDashboardTemplate } from './templates/dashboard.template';

export type HoldingsCategory = 'stocks' | 'bank-accounts';

export function renderDashboard(
  period: PerformancePeriod,
  connectedData?: InvestmentSheetsData,
  holdingsCategory: HoldingsCategory = 'stocks',
): string {
  const data = getDashboardData(period, connectedData);
  const viewModel = presentDashboard(data, holdingsCategory);

  return renderDashboardTemplate(viewModel);
}