import type { Investment } from "../../../../types/investment";
import { formatCurrency, formatPercent } from "../../../../utils/formatters";
import { calculateHoldingMetrics } from "../../utils/dashboard-calculations";
import { presentAssetLogo } from "../../../../components/asset-logo/asset-logo.presenter";
import { renderAssetLogoTemplate } from "../../../../components/asset-logo/asset-logo.template";
import type { HoldingsListData } from "./holdings-list.types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function renderHolding(investment: Investment): string {
  const metrics = calculateHoldingMetrics(investment);

  const isBankAccount =
    investment.assetType === "fixed-income" ||
    investment.assetType === "bank-account";

  const logoViewModel = presentAssetLogo({
    symbol: investment.symbol,
    name: investment.name,
    size: "md",
    category: isBankAccount ? "bank" : "ticker",
  });

  const logoHtml = renderAssetLogoTemplate(logoViewModel);
  const gainClass = metrics.gain >= 0 ? "text-positive" : "text-negative";

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
  category = "stocks",
}: HoldingsListData): string {
  const isBankAccountsCategory = category === "bank-accounts";

  const filteredInvestments = investments.filter((investment) => {
    if (isBankAccountsCategory) {
      return (
        investment.assetType === "fixed-income" ||
        investment.assetType === "bank-account"
      );
    }

    return (
      investment.assetType === "stock" ||
      investment.assetType === "etf" ||
      investment.assetType === "crypto"
    );
  });

  const visibleInvestments =
    limit === undefined
      ? filteredInvestments
      : filteredInvestments.slice(0, limit);

  const investmentsByLocation = new Map<string, Investment[]>();

  visibleInvestments.forEach((investment) => {
    const location = investment.location?.trim() || "Sin ubicación";
    const group = investmentsByLocation.get(location) ?? [];
    group.push(investment);
    investmentsByLocation.set(location, group);
  });

  const holdingsHtml = Array.from(investmentsByLocation.entries())
    .map(([location, holdings]) => `
      <section class="holdings-location-group">
        <h3 class="holdings-location-group__title">${escapeHtml(location)}</h3>
        ${holdings.map(renderHolding).join("")}
      </section>
    `)
    .join("");

  const emptyMessage = isBankAccountsCategory
    ? "No hay cuentas bancarias registradas."
    : "No hay acciones ni ETFs registrados.";

  return `
    <section class="holdings-section">
     

      <div
        class="holdings-toggle"
        role="group"
        aria-label="Categoría de posiciones">
        <button
          type="button"
          class="holdings-toggle__option${
            category === "stocks" ? " holdings-toggle__option--active" : ""
          }"
          data-holdings-category="stocks"
          aria-pressed="${category === "stocks"}">
          <span class="holdings-toggle__icon" aria-hidden="true">↗</span>
          <span>Acciones</span>
        </button>

        <button
          type="button"
          class="holdings-toggle__option${
            isBankAccountsCategory ? " holdings-toggle__option--active" : ""
          }"
          data-holdings-category="bank-accounts"
          aria-pressed="${isBankAccountsCategory}">
          <span class="holdings-toggle__icon" aria-hidden="true">▤</span>
          <span>Cuentas bancarias</span>
        </button>
      </div>

       <div class="section-heading">
        <h2>Mis posiciones</h2>
        <span class="section-count">${visibleInvestments.length}</span>
      </div>

      <div class="holdings-list">
        ${holdingsHtml || `<p class="holdings-empty">${emptyMessage}</p>`}
      </div>
    </section>
  `;
}
