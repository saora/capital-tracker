import type { Investment } from '../../../../types/investment';
import { formatCurrency, formatPercent } from '../../../../utils/formatters';
import { calculateHoldingMetrics } from '../../utils/dashboard-calculations';
import { presentAssetLogo } from '../../../../components/asset-logo/asset-logo.presenter';
import { renderAssetLogoTemplate } from '../../../../components/asset-logo/asset-logo.template';
import type { HoldingsListData } from './holdings-list.types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

function renderHolding(investment: Investment): string {
  const metrics = calculateHoldingMetrics(investment);
  const logoViewModel = presentAssetLogo({
    symbol: investment.symbol,
    name: investment.name,
    size: 'md',
  });

  const logoHtml = renderAssetLogoTemplate(logoViewModel);
  const gainClass = metrics.gain >= 0 ? 'text-positive' : 'text-negative';

  return `
    <article class="holding-item">
      <div class="holding-identity">
        ${logoHtml}
        <div class="holding-description">
          <span class="holding-symbol">${escapeHtml(investment.symbol)}</span>
          <span class="holding-name">${escapeHtml(investment.name)}</span>
        </div>
      </div>

      <div class="holding-performance">
        <span class="holding-value">
          ${formatCurrency(metrics.marketValue, investment.currency)}
        </span>
        <span class="holding-gain ${gainClass}">
          ${formatPercent(metrics.gainPercent)}
        </span>
      </div>
    </article>
  `;
}

export function presentHoldingsList({
  investments,
  limit,
}: HoldingsListData): string {
  const visibleInvestments =
    limit === undefined ? investments : investments.slice(0, limit);

  const holdingsHtml = visibleInvestments.map(renderHolding).join('');

  return `
    <section class="holdings-section">
      <div class="section-heading">
        <h2>Mis posiciones</h2>
        <span class="section-count">${visibleInvestments.length}</span>
      </div>

      <div class="holdings-list">
        ${holdingsHtml}
      </div>
    </section>
  `;
}
