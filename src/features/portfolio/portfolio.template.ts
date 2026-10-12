import type { PortfolioViewModel } from './portfolio.types';
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

export function renderPortfolioTemplate(
  viewModel: PortfolioViewModel,
): string {
  const positionsByLocation = new Map<string, typeof viewModel.positions>();

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

      return `
        <section class="card portfolio-location-card" aria-labelledby="portfolio-location-${escapeHtml(location.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
          <header class="portfolio-location-card__header">
            <h3
              class="dashboard__section-title portfolio-location-card__title"
              id="portfolio-location-${escapeHtml(location.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">
              ${escapeHtml(location)}
            </h3>
            <span class="portfolio-location-card__count">${positions.length}</span>
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

      <div class="card">
        <p class="text-secondary">Posiciones registradas</p>
        <strong class="dashboard__metric-value">
          ${viewModel.totalPositions} activos
        </strong>
      </div>

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