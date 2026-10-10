import type { PortfolioSummary } from '../../../types/portfolio';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function renderMetricsGrid(
  summary: PortfolioSummary,
): string {
  const returnPercent = summary.invested
    ? (summary.totalGain / summary.invested) * 100
    : 0;

  return `
    <section class="dashboard__metrics"
      aria-label="Indicadores principales">

      <article class="card metric-card">
        <span class="metric-card__label">Capital invertido</span>
        <strong class="dashboard__metric-value">
          ${formatCurrency(summary.invested, summary.currency)}
        </strong>
      </article>

      <article class="card metric-card">
        <span class="metric-card__label">Ganancia total</span>
        <strong class="dashboard__metric-value ${
          summary.totalGain >= 0 ? 'text-positive' : 'text-negative'
        }">
          ${summary.totalGain > 0 ? '+' : ''}${formatCurrency(
            summary.totalGain,
            summary.currency,
          )}
        </strong>
        <span class="metric-card__detail">
          ${formatPercent(returnPercent)}
        </span>
      </article>
    </section>
  `;
}