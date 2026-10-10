import type { BalanceCardData } from './balance-card.types';
import { formatCurrency, formatPercent } from '../../../../utils/formatters';

export function presentBalanceCard({
  summary,
}: BalanceCardData): string {
  const changeClass = summary.dailyChange >= 0
    ? 'text-positive'
    : 'text-negative';

  const changeIcon = summary.dailyChange >= 0 ? '↑' : '↓';

  return `
    <section class="dashboard__balance card">
      <div class="dashboard__balance-top">
        <p class="dashboard__balance-label">Patrimonio total</p>
        <span class="currency-tag">${summary.currency}</span>
      </div>

      <p class="dashboard__balance-value">
        ${formatCurrency(summary.totalValue, summary.currency)}
      </p>

      <p class="dashboard__balance-change ${changeClass}">
        ${changeIcon} ${formatPercent(summary.dailyChange)}
        <span>hoy</span>
      </p>
    </section>
  `;
}