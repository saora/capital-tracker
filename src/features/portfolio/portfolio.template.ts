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

function formatSignedCurrency(value: number, currency: PortfolioPosition['currency']): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(value), currency)}`;
}

export function renderPortfolioTemplate(
  viewModel: PortfolioViewModel,
): string {
  const positionsByLocation = new Map<string, PortfolioPosition[]>();

  viewModel.positions.forEach((position) => {
    const location = position.location || 'Sin ubicación';
    const group = positionsByLocation.get(location) ?? [];
    group.push(position);
    positionsByLocation.set(location, group);
  });

  const positionsHtml = Array.from(positionsByLocation.entries())
    .map(([location, positions]) => {
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
                <strong>${escapeHtml(position.valueLabel)}</strong>

                <span class="portfolio-holding__gain ${position.gainClass}">
                  ${escapeHtml(position.gainLabel)}
                </span>
              </div>
            </article>
          `;
        })
        .join('');

      const invested = positions.reduce((total, position) => total + position.investedValue, 0);
      const gain = positions.reduce((total, position) => total + position.gainValue, 0);
      const performance = invested > 0 ? (gain / invested) * 100 : 0;
      const gainClass = gain >= 0 ? 'text-positive' : 'text-negative';
      const amountLabel = formatSignedCurrency(gain, viewModel.currency);
      const locationId = location.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      return `
        <section class="card portfolio-location-card" aria-labelledby="portfolio-location-${escapeHtml(locationId)}">
          <header class="portfolio-location-card__header">
            <h3
              class="dashboard__section-title portfolio-location-card__title"
              id="portfolio-location-${escapeHtml(locationId)}">
              ${escapeHtml(location)}
            </h3>
            <div class="portfolio-location-card__performance ${gainClass}">
              <strong>${escapeHtml(formatPercent(performance))}</strong>
              <span>(${escapeHtml(amountLabel)})</span>
            </div>
          </header>
          <div class="portfolio-location-card__holdings">
            ${rowsHtml}
          </div>
        </section>
      `;
    })
    .join('');

  const totalGainLabel = `${viewModel.totalPerformanceLabel} (${viewModel.totalGainAmountLabel})`;

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
          <strong class="${viewModel.totalGainClass}">
            ${escapeHtml(totalGainLabel)}
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
