import type {
  PerformanceChartViewModel,
} from './performance-chart.types';

export function renderPerformanceChartTemplate(
  viewModel: PerformanceChartViewModel,
): string {
  return `
    <section
      class="dashboard__section"
      aria-labelledby="performance-title"
    >
      <div class="card performance-card">
        <div class="card__header">
          <div>
            <h2
              class="dashboard__section-title"
              id="performance-title"
            >
              ${viewModel.title}
            </h2>

            <p class="performance-subtitle">
              ${viewModel.subtitle}
            </p>
          </div>

          <span
            class="performance-indicator ${viewModel.indicatorClass}"
          >
            ${viewModel.changeLabel}
          </span>
        </div>

        <div
          class="chart-periods"
          role="group"
          aria-label="Periodo de rendimiento"
        >
          ${viewModel.periodsHtml}
        </div>

        <div class="performance-chart">
          ${viewModel.chartHtml}
        </div>

        <div class="chart-labels">
          <span>${viewModel.firstValueLabel}</span>
          <span>${viewModel.lastValueLabel}</span>
        </div>
      </div>
    </section>
  `;
}