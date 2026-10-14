import type { PortfolioViewModel, PortfolioPosition } from './portfolio.types';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { presentAssetLogo } from '../../components/asset-logo/asset-logo.presenter';
import { renderAssetLogoTemplate } from '../../components/asset-logo/asset-logo.template';

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

function formatCurrencyAmount(value: number, currency: PortfolioPosition['currency']): string {
  return formatCurrency(Math.abs(value), currency);
}

export function renderPortfolioTemplate(
  viewModel: PortfolioViewModel,
): string {
  const totalPortfolioValue = viewModel.positions.reduce(
    (total, position) => total + position.currentValue,
    0,
  );
  const positionsByLocation = new Map<string, PortfolioPosition[]>();

  viewModel.positions.forEach((position) => {
    const location = position.location || 'Sin ubicación';
    const group = positionsByLocation.get(location) ?? [];
    group.push(position);
    positionsByLocation.set(location, group);
  });

  const positionsHtml = Array.from(positionsByLocation.entries())
    .map(([location, groupedPositions]) => {
      // Sort by portfolio weight (equivalent to current value because all positions share the same portfolio denominator).
      const positions = [...groupedPositions].sort(
        (a, b) => b.currentValue - a.currentValue,
      );
      const rowsHtml = positions
        .map((position) => {
          const logoViewModel = presentAssetLogo({
            symbol: position.symbol,
            name: position.name,
            size: 'md',
            category: 'ticker',
          });

          const logoHtml = renderAssetLogoTemplate(logoViewModel);

          return `
            <article class="holding-row">
              <div class="holding-row__identity">
                ${logoHtml}

                <div class="holding-row__name">
                  <strong>${escapeHtml(position.symbol)}</strong>

                  <span class="portfolio-holding__quote">
                    <span class="${position.dailyChangeClass}">
                      ${escapeHtml(position.dailyChangeLabel)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>${escapeHtml(position.currentPriceLabel)}</span>
                  </span>
                </div>
              </div>

              <div class="holding-row__numbers">
                <div class="holding-row__value-line">
                  <span class="holding-row__quantity">${escapeHtml(position.quantityLabel)}</span>
                  <span class="holding-row__value-separator" aria-hidden="true">·</span>
                  <strong>${escapeHtml(position.valueLabel)}</strong>
                </div>

                <span class="portfolio-holding__gain ${position.gainClass}">
                  <span class="portfolio-holding__gain-percent"><span aria-hidden="true">${escapeHtml(position.gainArrow)}</span> ${escapeHtml(position.gainPercentLabel)}</span>
                  <span aria-hidden="true">·</span>
                  <strong>${escapeHtml(position.gainAmountLabel)}</strong>
                </span>
              </div>
            </article>
          `;
        })
        .join('');

      const invested = positions.reduce((total, position) => total + position.investedValue, 0);
      const currentValue = positions.reduce((total, position) => total + position.currentValue, 0);
      const gain = positions.reduce((total, position) => total + position.gainValue, 0);
      const performance = invested > 0 ? (gain / invested) * 100 : 0;
      const gainClass = gain >= 0 ? 'text-positive' : 'text-negative';
      const amountLabel = formatCurrencyAmount(gain, viewModel.currency);
      const signedAmountLabel = `${gain > 0 ? '+' : gain < 0 ? '-' : ''}${amountLabel}`;
      const currentValueLabel = formatCurrency(currentValue, viewModel.currency);
      const performanceLabel = formatPercent(performance);
      const portfolioWeight = totalPortfolioValue > 0
        ? (currentValue / totalPortfolioValue) * 100
        : 0;
      const portfolioWeightLabel = formatPercent(portfolioWeight);
      const locationId = location.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const normalizedLocation = location.toLowerCase();
      const isBrokerage = normalizedLocation === 'gbm' || normalizedLocation === 'bitso';
      const portfolioWeightHtml = isBrokerage
        ? `<span class="portfolio-location-card__weight">PESO: ${escapeHtml(portfolioWeightLabel)}</span>`
        : '';
      const brokerLogo = isBrokerage
        ? `<span class="portfolio-location-card__logo"><img src="${import.meta.env.BASE_URL}logos/holdings/${normalizedLocation}.svg" alt="" aria-hidden="true" loading="lazy" decoding="async" /></span>`
        : '';
      const countBadge = isBrokerage
        ? `<span class="portfolio-location-card__count portfolio-location-card__count--dark" aria-label="${positions.length} posiciones">${positions.length}</span>`
        : '';

      return `
        <section class="card portfolio-location-card" aria-labelledby="portfolio-location-${escapeHtml(locationId)}">
          <header class="portfolio-location-card__header holding-row">
            <div class="portfolio-location-card__identity">
              ${brokerLogo}
              <div class="portfolio-location-card__name">
                <div class="portfolio-location-card__title-line">
                  <h3
                    class="dashboard__section-title portfolio-location-card__title"
                    id="portfolio-location-${escapeHtml(locationId)}">
                    ${escapeHtml(location)}
                  </h3>
                  ${countBadge}
                </div>
                ${portfolioWeightHtml}
              </div>
            </div>
            <div class="portfolio-location-card__numbers">
              <strong class="portfolio-location-card__value">${escapeHtml(currentValueLabel)}</strong>
              <div class="portfolio-location-card__performance">
                <span class="portfolio-location-card__gain ${gainClass}">${escapeHtml(signedAmountLabel)}</span>
                <span class="portfolio-location-card__return ${gainClass}">${escapeHtml(performanceLabel)}</span>
              </div>
            </div>
          </header>
          <div class="portfolio-location-card__holdings">
            ${rowsHtml}
          </div>
        </section>
      `;
    })
    .join('');


  return `
    <section class="dashboard">
      <header class="page-header">
        <div>
          <p class="dashboard__greeting">Consulta tus activos</p>
          <h1 class="page-title">Portafolio</h1>
        </div>
      </header>

      <section class="dashboard__balance card portfolio-summary-card">
        <div class="dashboard__balance-top">
          <p class="dashboard__balance-label">Valor del portafolio</p>
          <span class="currency-tag">${escapeHtml(viewModel.currency)}</span>
        </div>
        <p class="dashboard__balance-value">
          ${escapeHtml(viewModel.totalValueLabel)}
        </p>
        <div class="portfolio-summary-card__performance">
          <span class="portfolio-summary-card__label">Ganancia total</span>
          <strong class="${viewModel.totalGainClass} portfolio-summary-card__gain">
            <span class="portfolio-summary-card__gain-percent">${escapeHtml(viewModel.totalPerformanceLabel)}</span>
            <span aria-hidden="true">·</span>
            <span>${escapeHtml(viewModel.totalGainAmountLabel)}</span>
          </strong>
        </div>
      </section>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Acciones y ETF</h2>

        <div class="portfolio-location-list">
          ${
            positionsHtml ||
            '<div class="card"><p class="holdings-empty">No hay acciones ni ETF registrados.</p></div>'
          }
        </div>
      </section>

      <p class="demo-disclaimer">
        ${escapeHtml(viewModel.disclaimer)}
      </p>
    </section>
  `;
}
