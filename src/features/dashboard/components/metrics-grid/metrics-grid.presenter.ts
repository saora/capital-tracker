import type { MetricsGridData } from './metrics-grid.types';
import { formatCurrency } from '../../../../utils/formatters';

export function presentMetricsGrid({
  summary,
}: MetricsGridData): string {
  const gainClass = summary.totalGain >= 0
    ? 'text-positive'
    : 'text-negative';

  return `
    <section class="dashboard__metrics" aria-label="Resumen financiero">
      <article class="metric-card">
        <p class="text-secondary">Capital invertido</p>
        <p class="dashboard__metric-value">
          ${formatCurrency(summary.invested, summary.currency)}
        </p>
      </article>

      <article class="metric-card">
        <p class="text-secondary">Ganancia total</p>
        <p class="dashboard__metric-value ${gainClass}">
          ${formatCurrency(summary.totalGain, summary.currency)}
        </p>
      </article>
    </section>
  `;
}