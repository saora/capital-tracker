// src/features/dashboard/templates/holdings-list.template.ts

import type { Investment } from '../../../types/investment';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

export function renderHoldingsList(
  investments: Investment[],
): string {
  const holdings = investments.slice(0, 4);

  if (holdings.length === 0) {
    return `
      <section class="dashboard__section">
        <div class="section-heading">
          <h2 class="dashboard__section-title">Tus posiciones</h2>
        </div>

        <div class="card">
          <p class="text-secondary">
            Todavía no tienes inversiones registradas.
          </p>
        </div>
      </section>
    `;
  }

  const rows = holdings
    .map((investment) => {
      const marketValue =
        investment.quantity * investment.currentPrice;

      const investedValue =
        investment.quantity * investment.averageCost;

      const gain = marketValue - investedValue;

      const gainPercent = investedValue
        ? (gain / investedValue) * 100
        : 0;

      const isPositive = gain >= 0;

      return `
        <article class="holding-row">
          <div class="holding-row__identity">
            <div class="asset-avatar asset-avatar--${investment.assetType}">
              ${investment.symbol.slice(0, 1)}
            </div>

            <div>
              <p class="holding-row__symbol">
                ${investment.symbol}
              </p>

              <p class="holding-row__name">
                ${investment.name}
              </p>
            </div>
          </div>

          <div class="holding-row__numbers">
            <p class="holding-row__value">
              ${formatCurrency(marketValue, investment.currency)}
            </p>

            <p class="${
              isPositive ? 'text-positive' : 'text-negative'
            }">
              ${formatPercent(gainPercent)}
            </p>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <section class="dashboard__section" aria-labelledby="holdings-title">
      <div class="section-heading">
        <h2 class="dashboard__section-title" id="holdings-title">
          Tus posiciones
        </h2>

        <button
          type="button"
          class="text-action"
          data-route="portfolio"
        >
          Ver todas
        </button>
      </div>

      <div class="card holdings-list">
        ${rows}
      </div>
    </section>
  `;
}