import type {
  DashboardViewModel,
} from '../dashboard.types';

export function renderDashboardTemplate(
  viewModel: DashboardViewModel,
): string {
  return `
    <div class="dashboard">
      <header class="page-header dashboard__greeting">
        <div>
          <p class="page-subtitle">${viewModel.greeting}</p>
          <h1 class="page-title">Capital Tracker</h1>
        </div>
      </header>

      ${viewModel.balanceCardHtml}
      ${viewModel.metricsGridHtml}
      ${viewModel.performanceChartHtml}
      ${viewModel.holdingsListHtml}

      <p class="demo-disclaimer">
        ${viewModel.disclaimer}
      </p>
    </div>
  `;
}