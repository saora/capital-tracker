import type { PortfolioViewModel, PortfolioPosition, PortfolioProvider } from './portfolio.types';
import { formatCurrency } from '../../utils/formatters';
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

const providers: PortfolioProvider[] = ['GBM', 'BITSO', 'BANCO'];

function renderProviderFilter(selected: PortfolioProvider): string {
  return providers.map((provider) => `
    <button
      type="button"
      class="chart-period${provider === selected ? ' chart-period--active' : ''}"
      data-portfolio-provider="${provider}"
      aria-pressed="${provider === selected}"
    >${provider}</button>
  `).join('');
}

export function renderPortfolioTemplate(viewModel: PortfolioViewModel): string {
  const positions = [...viewModel.positions].sort((a, b) => b.currentValue - a.currentValue);
  const rowsHtml = positions.map((position) => {
    const isBankAsset = position.assetType === 'fixed-income' || position.assetType === 'bank-account';
    const logoViewModel = presentAssetLogo({
      symbol: position.symbol,
      name: position.name,
      size: 'md',
      category: isBankAsset ? 'bank' : 'ticker',
    });
    const logoHtml = renderAssetLogoTemplate(logoViewModel);
    const quoteHtml = isBankAsset
      ? `<span class="portfolio-holding__quote"><span>${position.assetType === 'fixed-income' ? 'Renta fija' : 'Cuenta bancaria'}</span></span>`
      : `<span class="portfolio-holding__quote">
          <span class="${position.dailyChangeClass}">${escapeHtml(position.dailyChangeLabel)}</span>
          <span aria-hidden="true">·</span>
          <span>${escapeHtml(position.currentPriceLabel)}</span>
        </span>`;

    return `
      <article class="holding-row">
        <div class="holding-row__identity">
          ${logoHtml}
          <div class="holding-row__name">
            <strong>${escapeHtml(position.symbol)}</strong>
            ${quoteHtml}
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
            <strong aria-hidden="true">·</strong>
            <strong>${escapeHtml(position.gainAmountLabel)}</strong>
          </span>
        </div>
      </article>
    `;
  }).join('');

  const currentValue = positions.reduce((total, position) => total + position.currentValue, 0);
  const gain = viewModel.totalGainValue;
  const gainClass = viewModel.totalGainClass;
  const signedGainLabel = `${gain > 0 ? '+' : gain < 0 ? '-' : ''}${formatCurrencyAmount(gain, viewModel.currency)}`;
  const performanceLabel = viewModel.totalPerformanceLabel;
  const emptyMessage = viewModel.provider === 'BANCO'
    ? 'No hay activos bancarios registrados.'
    : `No hay posiciones registradas en ${viewModel.provider}.`;

  return `
    <section class="dashboard portfolio-page">
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
        <p class="dashboard__balance-value">${escapeHtml(formatCurrency(currentValue, viewModel.currency))}</p>
        <div class="portfolio-summary-card__performance">
          <span class="portfolio-summary-card__label">Ganancia total</span>
          <strong class="${gainClass} portfolio-summary-card__gain">
            <span class="portfolio-summary-card__gain-percent">${escapeHtml(performanceLabel)}</span>
            <span aria-hidden="true">·</span>
            <span>${escapeHtml(signedGainLabel)}</span>
          </strong>
        </div>
      </section>

      <header class="portfolio-filter-header portfolio-filter-header--outside">
        <h2 class="dashboard__section-title" id="portfolio-positions-title">Posiciones</h2>
        <span class="portfolio-location-card__count portfolio-location-card__count--dark" aria-label="${positions.length} posiciones">${positions.length}</span>
      </header>
      <section class="card portfolio-location-card" aria-labelledby="portfolio-positions-title">
        <div class="chart-periods portfolio-provider-filter" role="group" aria-label="Filtrar portafolio">
          ${renderProviderFilter(viewModel.provider)}
        </div>
        <div class="portfolio-location-card__holdings">
          ${rowsHtml || `<p class="holdings-empty">${escapeHtml(emptyMessage)}</p>`}
        </div>
      </section>

      <p class="demo-disclaimer">${escapeHtml(viewModel.disclaimer)}</p>
    </section>
  `;
}
