import type { Investment } from "../../types/investment";
import { formatCurrency, formatPercent } from "../../utils/formatters";
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

function formatCurrencyAmount(value: number, currency: "MXN" | "USD"): string {
  return formatCurrency(Math.abs(value), currency);
}

function parseGainSummaryValue(value?: string): number | undefined {
  if (!value?.trim()) return undefined;

  const text = value.trim();
  const isParenthesizedNegative = /^\(.*\)$/.test(text);
  const normalized = text
    .replace(/[()$€£,\s]/g, "")
    .replace(/[^\d.+-]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return undefined;
  return isParenthesizedNegative ? -Math.abs(parsed) : parsed;
}

export function presentPortfolio(
  investments: Investment[],
  connected: boolean,
  gainSummaryText?: string,
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
      const quantityText = String(item.quantity);
      const [quantityInteger, quantityDecimals = ""] = quantityText.split(".");
      const quantityLabel =
        quantityDecimals.length > 3
          ? `${new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 0,
            }).format(Math.trunc(item.quantity))}.${quantityDecimals.slice(0, 3)}`
          : new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 3,
            }).format(item.quantity);
      const gainPercentLabel = `${Math.abs(gainPercent).toFixed(2)}%`;
      const gainArrow = gain > 0 ? "↗" : gain < 0 ? "↘" : "→";

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
        location: item.location || "Sin ubicación",
        currentValue: value,
        investedValue: cost,
        gainValue: gain,
        gainPercent,
        valueLabel: formatPositionValue(value, item.currency),
        quantityLabel,
        gainPercentLabel,
        gainAmountLabel,
        gainArrow,
        currentPriceLabel: formatMarketPrice(item.currentPrice, item.currency),
        dailyChangeLabel: formatDailyChange(dailyChange),
        dailyChangeClass,
        gainClass: gain >= 0 ? "text-positive" : "text-negative",
      };
    });

  positions.sort((a, b) => {
    const getLocationOrder = (location: string): number => {
      const normalized = location.trim().toLocaleLowerCase("es-MX");
      if (normalized === "gbm") return 0;
      if (normalized === "bitso") return 1;
      return 2;
    };

    const priorityOrder = getLocationOrder(a.location) - getLocationOrder(b.location);
    if (priorityOrder !== 0) return priorityOrder;

    if (getLocationOrder(a.location) === 2) {
      const locationOrder = a.location.localeCompare(b.location, "es-MX");
      if (locationOrder !== 0) return locationOrder;
    }

    return b.gainPercent - a.gainPercent;
  });

  // The current Google Sheets service normalizes all position values to MXN.
  const currency = positions[0]?.currency ?? "MXN";
  const totalValue = positions.reduce((total, position) => total + position.currentValue, 0);
  const investedValue = positions.reduce((total, position) => total + position.investedValue, 0);
  const totalGain = totalValue - investedValue;
  const totalPerformance = investedValue > 0 ? (totalGain / investedValue) * 100 : 0;
  const sheetGainValue = parseGainSummaryValue(gainSummaryText);
  const totalPerformanceLabel =
    sheetGainValue !== undefined && investedValue > 0
      ? formatPercent((sheetGainValue / investedValue) * 100)
      : formatPercent(totalPerformance);
  const totalGainAmountLabel =
    sheetGainValue !== undefined
      ? formatCurrency(sheetGainValue, currency)
      : formatCurrencyAmount(totalGain, currency);

  return {
    positions,
    totalPositions: positions.length,
    totalValueLabel: formatCurrency(totalValue, currency),
    totalGainAmountLabel,
    totalPerformanceLabel,
    totalGainClass: totalGain >= 0 ? "text-positive" : "text-negative",
    currency,
    disclaimer: connected
      ? "Posiciones obtenidas de Google Sheets. Los valores reflejan la última información guardada en la hoja."
      : "Datos ficticios. Los valores están en la moneda indicada por activo.",
  };
}
