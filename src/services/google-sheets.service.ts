import { signInWithGoogle } from "./google-auth.service";
import type { Investment, AssetType } from "../types/investment";
import type { PortfolioSummary, ChartPoint } from "../types/portfolio";
import {
  savePortfolioSnapshot,
  getPortfolioHistory,
} from "./portfolio-history.service";

export interface InvestmentSheetsData {
  investments: Investment[];
  summary: PortfolioSummary;
  historyPoints: ChartPoint[];
  gainSummaryText?: string;
}

type SheetRow = Array<string | number | boolean | null>;

const API_URL = "https://sheets.googleapis.com/v4/spreadsheets";

function getSpreadsheetId(): string {
  const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Falta VITE_GOOGLE_SHEET_ID en el archivo .env.local.");
  }

  return spreadsheetId;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseGainSummaryAmount(value: unknown): number {
  const text = String(value ?? "").trim();
  const match = text.match(/([+-]?\\d+(?:[.,]\\d+)?%)\\s*\\(?\\s*(-?\\$[\\d,]+(?:\\.\\d{2})?)\\s*\\)?/);

  if (!match) {
    throw new Error(
      'No se pudo interpretar la ganancia total desde "Renta variable"!A9. ' +
      "Verifica que la celda contenga el porcentaje y el importe de la ganancia.",
    );
  }

  const amountText = match[2].replace(/[$,\\s]/g, "");
  const amount = Number(amountText);

  if (!Number.isFinite(amount)) {
    throw new Error('El importe de ganancia en "Renta variable"!A9 no es válido.');
  }

  return amount;
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-MX");
}

async function readRange(token: string, range: string): Promise<SheetRow[]> {
  const url = new URL(
    `${API_URL}/${encodeURIComponent(
      getSpreadsheetId(),
    )}/values/${encodeURIComponent(range)}`,
  );

  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Portfolio reads must bypass the browser HTTP cache on every refresh.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Google Sheets respondió ${response.status}: ${await response.text()}`,
    );
  }

  const result = (await response.json()) as {
    values?: SheetRow[];
  };

  return result.values ?? [];
}

function getAssetType(symbol: string): AssetType {
  const normalized = normalize(symbol);

  if (normalized === "btc") return "crypto";

  if (["voo", "qqq", "ivvpeso", "ivvpesoishrs"].includes(normalized)) {
    return "etf";
  }

  return "stock";
}

interface ParsedInvestment {
  investment: Investment;
  invested: number;
  currentValue: number;
}

function makeInvestment(
  id: string,
  symbol: string,
  name: string,
  assetType: AssetType,
  invested: number,
  currentValue: number,
  quantity = 1,
): Investment {
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

  return {
    id,
    symbol,
    name,
    assetType,
    currency: "MXN",
    quantity: safeQuantity,
    averageCost: invested / safeQuantity,
    currentPrice: currentValue / safeQuantity,
  };
}

function parseFixedIncome(rows: SheetRow[]): ParsedInvestment[] {
  return rows
    .slice(1)
    .filter((row) => normalize(row[0]) === "renta fija")
    .map((row, index) => {
      const platform = String(row[2] ?? "").trim();
      const invested = toNumber(row[3]);
      const currentValue = toNumber(row[4]);

      if (!platform || (invested === 0 && currentValue === 0)) {
        return null;
      }

      return {
        investment: makeInvestment(
          `fixed-${index}-${platform}`,
          platform.toUpperCase(),
          platform,
          "fixed-income",
          invested,
          currentValue,
        ),
        invested,
        currentValue,
      };
    })
    .filter((item) => item !== null);
}

function parsePortfolioControl(rows: SheetRow[]): Map<string, string> {
  const activeAssets = new Map<string, string>();

  rows.forEach((row) => {
    const symbol = normalize(row[0]);
    const location = String(row[1] ?? "").trim();
    const status = normalize(row[2]);

    if (symbol && status === "activo") {
      activeAssets.set(symbol, location || "Sin ubicación");
    }
  });

  return activeAssets;
}

function parseVariableIncome(rows: SheetRow[]): ParsedInvestment[] {
  // A12:N27 contains the header followed by the current positions.
  return rows
    .slice(1)
    .map((row, index) => {
      const symbol = String(row[0] ?? "").trim();
      const invested = toNumber(row[9]);
      const currentValue = toNumber(row[10]);
      const quantity = toNumber(row[7]);
      const dailyChangePercent = toNumber(row[4]) * 100;

      if (
        !symbol ||
        ["total", "total general", "subtotal"].includes(normalize(symbol)) ||
        (invested === 0 && currentValue === 0)
      ) {
        return null;
      }

      return {
        investment: {
          ...makeInvestment(
            `variable-${index}-${symbol}`,
            symbol.toUpperCase(),
            symbol.toUpperCase(),
            getAssetType(symbol),
            invested,
            currentValue,
            quantity,
          ),
          dailyChangePercent,
        },
        invested,
        currentValue,
      };
    })
    .filter((item) => item !== null);
}

export async function getInvestmentSheetsData(
  accessToken?: string,
): Promise<InvestmentSheetsData> {
  const token = accessToken ?? (await signInWithGoogle());

  const [investmentRows, variableRows, portfolioControlRows, gainSummaryRows] = await Promise.all([
    readRange(token, "'Inversiones'!A9:J"),
    readRange(token, "'Renta variable'!A12:N27"),
    readRange(token, "'Portfolio'!A2:C"),
    readRange(token, "'Renta variable'!A9"),
  ]);

  const fixedIncome = parseFixedIncome(investmentRows);
  const activeAssets = parsePortfolioControl(portfolioControlRows);
  const variableIncomeFromSheets = parseVariableIncome(variableRows)
    .filter((item) => activeAssets.has(normalize(item.investment.symbol)))
    .map((item) => ({
      ...item,
      investment: {
        ...item.investment,
        location:
          activeAssets.get(normalize(item.investment.symbol)) ?? "Sin ubicación",
      },
    }));

  // Google Sheets is the source of truth for variable-income values.
  // Do not overwrite its formula-calculated values with a second market feed.
  const variableIncome = variableIncomeFromSheets;
  const parsedInvestments = [...fixedIncome, ...variableIncome];

  if (parsedInvestments.length === 0) {
    throw new Error(
      "No se encontraron posiciones. Verifica los nombres de las hojas y sus columnas.",
    );
  }

  const invested = parsedInvestments.reduce(
    (total, item) => total + item.invested,
    0,
  );

  const totalValue = parsedInvestments.reduce(
    (total, item) => total + item.currentValue,
    0,
  );

  // Calculate the total daily change from the percentage values in the sheet,
  // weighted by each variable-income position's current value.
  const dailyChangeAmount = variableIncome.reduce((total, item) => {
    const dailyChangePercent = item.investment.dailyChangePercent;

    if (
      typeof dailyChangePercent !== "number" ||
      !Number.isFinite(dailyChangePercent)
    ) {
      return total;
    }

    return total + item.currentValue * (dailyChangePercent / 100);
  }, 0);

  const dailyChange = totalValue > 0
    ? (dailyChangeAmount / totalValue) * 100
    : 0;

  const gainSummaryText = String(gainSummaryRows[0]?.[0] ?? "").trim();
  const totalGain = parseGainSummaryAmount(gainSummaryText);

  const summary: PortfolioSummary = {
    invested,
    totalValue,
    // Use the spreadsheet's gain summary so realized gains from sales are included.
    totalGain,
    dailyChange,
    currency: "MXN",
  };

  console.table(
    parsedInvestments.map((item) => ({
      activo: item.investment.symbol,
      invertido: item.invested,
      valorActual: item.currentValue,
      ganancia: item.currentValue - item.invested,
    })),
  );

  console.log("RESUMEN CALCULADO", {
    capitalInvertido: invested,
    patrimonioTotal: totalValue,
    gananciaTotal: totalValue - invested,
    cantidadPosiciones: parsedInvestments.length,
  });

  let historyPoints: ChartPoint[] = [];

  try {
    await savePortfolioSnapshot(token, {
      invested: summary.invested,
      totalValue: summary.totalValue,
      totalGain: summary.totalGain,
    });
  } catch (error) {
    console.warn("No se pudo guardar la captura del portafolio.", error);
  }

  try {
    historyPoints = await getPortfolioHistory(token);
  } catch (error) {
    console.warn("No se pudo leer el historial del portafolio.", error);
  }

  return {
    investments: parsedInvestments.map((item) => item.investment),
    summary,
    historyPoints,
    gainSummaryText: gainSummaryText || undefined,
  };
}
