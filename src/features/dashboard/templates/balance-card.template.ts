import type { PortfolioSummary } from '../../../types/portfolio';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function renderBalanceCard(
  summary: PortfolioSummary,
): string {
  return `
    <section class="dashboard__balance"
      aria-label="Patrimonio total">
      <div class="dashboard__balance-top">
        <span class="dashboard__balance-label">
          Valor total del portafolio
        </span>
        <span class="demo-tag">DEMO</span>
      </div>

      <p class="dashboard__balance-value">
        ${formatCurrency(summary.totalValue, summary.currency)}
      </p>

      <div class="dashboard__balance-change">
        <span aria-hidden="true">↗</span>
        ${formatPercent(summary.dailyChange)}
        <span>hoy · dato ilustrativo</span>
      </div>
    </section>
  `;
}