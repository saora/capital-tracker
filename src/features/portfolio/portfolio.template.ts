
import type { PortfolioViewModel } from './portfolio.types';

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
  const positionsHtml = viewModel.positions
    .map(
      (position) => `
        <article class="holding-row">
          <div class="holding-row__identity">
            <div class="asset-avatar asset-avatar--${position.assetType}">
              ${escapeHtml(position.symbol.slice(0, 1))}
            </div>

            <div class="holding-row__name">
              <strong>${escapeHtml(position.symbol)}</strong>
              <span>${escapeHtml(position.name)}</span>
            </div>
          </div>

          <div class="holding-row__numbers">
            <strong>${escapeHtml(position.valueLabel)}</strong>

            <span class="${position.gainClass}">
              ${escapeHtml(position.gainPercentLabel)}
            </span>
          </div>
        </article>
      `,
    )
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

        <div class="card holdings-list">
          ${
            positionsHtml ||
            '<p class="holdings-empty">No hay acciones ni ETF registrados.</p>'
          }
        </div>
      </section>

      <p class="demo-disclaimer">
        ${escapeHtml(viewModel.disclaimer)}
      </p>
    </section>
  `;
}
