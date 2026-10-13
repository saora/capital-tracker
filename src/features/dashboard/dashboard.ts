
import type { PerformancePeriod } from '../../types/portfolio';
import type { InvestmentSheetsData } from '../../services/google-sheets.service';

import { getDashboardData } from './services/dashboard.service';
import { presentDashboard } from './dashboard.presenter';
import { renderDashboardTemplate } from './templates/dashboard.template';

export function renderDashboard(
  period: PerformancePeriod,
  connectedData?: InvestmentSheetsData,
): string {
  const data = getDashboardData(period, connectedData);
  const viewModel = presentDashboard(data);

  return renderDashboardTemplate(viewModel);
}