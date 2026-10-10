import type { InvestmentSheetsData } from '../../services/google-sheets.service';
import { demoInvestments } from '../../services/investment-service';
import { formatCurrency } from '../../utils/formatters';

export function renderPortfolio(
  connectedData?: InvestmentSheetsData,
): string {
  const investments =
    connectedData?.investments ?? demoInvestments;

  const positions = investments
    .map((item) => {
      const value = item.quantity * item.currentPrice;
      const cost = item.quantity * item.averageCost;
      const gain = value - cost;
      const gainPercent = cost ? (gain / cost) * 100 : 0;

      return `
        <article class="holding-row">
          <div class="holding-row__identity">
            <div class="asset-avatar asset-avatar--${item.assetType}">
              ${item.symbol.slice(0, 1)}
            </div>

            <div class="holding-row__name">
              <strong>${item.symbol}</strong>
              <span>${item.name}</span>
            </div>
          </div>

          <div class="holding-row__numbers">
            <strong>${formatCurrency(value, item.currency)}</strong>

            <span class="${gain >= 0 ? 'text-positive' : 'text-negative'}">
              ${gain >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%
            </span>
          </div>
        </article>
      `;
    })
    .join('');

  const disclaimer = connectedData
    ? 'Posiciones obtenidas de Google Sheets. Los valores reflejan la última información guardada en la hoja.'
    : 'Datos ficticios. Los valores están en la moneda indicada por activo.';

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
          ${investments.length} activos
        </strong>
      </div>

      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Todas las posiciones</h2>

        <div class="card holdings-list">
          ${positions}
        </div>
      </section>

      <p class="demo-disclaimer">${disclaimer}</p>
    </section>
  `;
}