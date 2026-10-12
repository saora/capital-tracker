import type { Investment } from "../../types/investment";
import { formatCurrency } from "../../utils/formatters";
import type { PortfolioPosition, PortfolioViewModel } from "./portfolio.types";

function formatMarketPrice(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: value >= 1_000_000 ? 0 : 2,
    maximumFractionDigits: value >= 1_000_000 ? 0 : 2,
  }).format(value);
}

function formatPositionValue(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value >= 1_000_000 ? 0 : 2,
    maximumFractionDigits: value >= 1_000_000 ? 0 : 2,
  }).format(value);

  const symbol = currency === "MXN" ? "$" : `${currency} `;

  return `${symbol}${formatted}`;
}

function formatDailyChange(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/D";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function presentPortfolio(
  investments: Investment[],
  connected: boolean,
): PortfolioViewModel {
  const positions: PortfolioPosition[] = investments
    .filter(
      (item) =>
        item.assetType === "stock" ||
        item.assetType === "etf" ||
        item.assetType === "crypto",
    )
    .map((item) => {
      const value = item.quantity * item.currentPrice;
      const cost = item.quantity * item.averageCost;
      const gain = value - cost;
      const gainPercent = cost !== 0 ? (gain / cost) * 100 : 0;
      const dailyChange = item.dailyChangePercent;

      const hasDailyChange =
        typeof dailyChange === "number" && Number.isFinite(dailyChange);

      const gainAmountLabel = formatCurrency(Math.abs(gain), item.currency);

      const gainLabel =
        `${gain > 0 ? "+" : gain < 0 ? "-" : ""}${gainAmountLabel} ` +
        `(${gainPercent.toFixed(2)}%)`;

      let dailyChangeClass: PortfolioPosition["dailyChangeClass"];

      if (!hasDailyChange) {
        dailyChangeClass = "text-muted";
      } else if ((dailyChange ?? 0) >= 0) {
        dailyChangeClass = "text-positive";
      } else {
        dailyChangeClass = "text-negative";
      }

      return {
        symbol: item.symbol,
        name: item.name,
        assetType: item.assetType,
        currency: item.currency,
        valueLabel: formatPositionValue(value, item.currency),
        currentPriceLabel: formatMarketPrice(item.currentPrice, item.currency),
        dailyChangeLabel: formatDailyChange(dailyChange),
        dailyChangeClass,
        gainLabel,
        gainClass: gain >= 0 ? "text-positive" : "text-negative",
      };
    });

  positions.sort((a, b) => {
    const getGainPercent = (position: PortfolioPosition): number => {
      const match = position.gainLabel.match(/\((-?\d+(?:\.\d+)?)%\)/);
      return match ? Number(match[1]) : 0;
    };

    return getGainPercent(b) - getGainPercent(a);
  });

  return {
    positions,
    totalPositions: positions.length,
    disclaimer: connected
      ? "Posiciones obtenidas de Google Sheets. Los valores reflejan la última información guardada en la hoja."
      : "Datos ficticios. Los valores están en la moneda indicada por activo.",
  };
}
