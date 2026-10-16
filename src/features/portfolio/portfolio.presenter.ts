import type { Investment } from "../../types/investment";
import { formatCurrency, formatPercent } from "../../utils/formatters";
import type { PortfolioPosition, PortfolioProvider, PortfolioViewModel } from "./portfolio.types";

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

export function presentPortfolio(
  investments: Investment[],
  connected: boolean,
  provider: PortfolioProvider = "GBM",
  providerInvestedCapital?: number,
): PortfolioViewModel {
  const selectedInvestments = investments.filter((item) => {
    if (provider === "BANCO") {
      return item.assetType === "fixed-income" || item.assetType === "bank-account";
    }

    const location = (item.location ?? "").trim().toLocaleUpperCase("es-MX");
    return location === provider &&
      (item.assetType === "stock" || item.assetType === "etf" || item.assetType === "crypto");
  });

  const positions: PortfolioPosition[] = selectedInvestments
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
            }).format(Number(quantityInteger))}.${quantityDecimals.slice(0, 3)}`
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
  const positionInvestedValue = positions.reduce((total, position) => total + position.investedValue, 0);
  const investedValue =
    provider !== "BANCO" &&
    typeof providerInvestedCapital === "number" &&
    Number.isFinite(providerInvestedCapital)
      ? providerInvestedCapital
      : positionInvestedValue;
  const totalGain = totalValue - investedValue;
  const totalPerformance = investedValue > 0 ? (totalGain / investedValue) * 100 : 0;
  const totalPerformanceLabel = formatPercent(totalPerformance).replace(/^\+/, "");
  const totalGainAmountLabel = formatCurrencyAmount(totalGain, currency);

  return {
    positions,
    totalPositions: positions.length,
    totalValueLabel: formatCurrency(totalValue, currency),
    totalGainAmountLabel,
    totalGainValue: totalGain,
    totalPerformanceLabel,
    totalGainClass: totalGain >= 0 ? "text-positive" : "text-negative",
    currency,
    provider,
    disclaimer: connected
      ? "Posiciones obtenidas de Google Sheets. Los valores reflejan la última información guardada en la hoja."
      : "Datos ficticios. Los valores están en la moneda indicada por activo.",
  };
}
