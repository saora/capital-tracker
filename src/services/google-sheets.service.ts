import type { Investment, AssetType } from "../types/investment";
import type { PortfolioSummary, ChartPoint } from "../types/portfolio";
import { getMarketPrices } from "./market-prices.service";
import {
  savePortfolioSnapshot,
  getPortfolioHistory,
} from "./portfolio-history.service";

export interface InvestmentSheetsData {
  investments: Investment[];
  summary: PortfolioSummary;
  historyPoints: ChartPoint[];
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
  });

  if (!response.ok) {
    throw new Error(
      `Google Sheets respondió ${response.status}: ${await response.text()}`,
    );
  }

  const result = (await response.json()) as { values?: SheetRow[] };
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
    .filter((item): item is ParsedInvestment => item !== null);
}

function parseVariableIncome(rows: SheetRow[]): ParsedInvestment[] {
  return rows
    .map((row, index) => {
      const symbol = String(row[0] ?? "").trim();
      const invested = toNumber(row[9]);
      const currentValue = toNumber(row[10]);
      const quantity = toNumber(row[7]);

      if (
        !symbol ||
        ["total", "total general", "subtotal"].includes(normalize(symbol)) ||
        (invested === 0 && currentValue === 0)
      ) {
        return null;
      }

      return {
        investment: makeInvestment(
          `variable-${index}-${symbol}`,
          symbol.toUpperCase(),
          symbol.toUpperCase(),
          getAssetType(symbol),
          invested,
          currentValue,
          quantity,
        ),
        invested,
        currentValue,
      };
    })
    .filter((item): item is ParsedInvestment => item !== null);
}

export async function getInvestmentSheetsData(
  accessToken: string,
): Promise<InvestmentSheetsData> {
  if (!accessToken.trim()) {
    throw new Error(
      "Se requiere un token de Google válido para consultar las inversiones.",
    );
  }

  const token = accessToken;

  const [investmentRows, variableRows] = await Promise.all([
    readRange(token, "'Inversiones'!A9:J"),
    readRange(token, "'Renta variable'!A11:M"),
  ]);

  const fixedIncome = parseFixedIncome(investmentRows);
  const variableIncomeFromSheets = parseVariableIncome(variableRows);

  let marketPrices: Awaited<ReturnType<typeof getMarketPrices>> = {};

  try {
    marketPrices = await getMarketPrices();
    console.log("Precios externos cargados correctamente.");
  } catch (error) {
    console.warn(
      "No se pudieron cargar los precios externos. Se usarán los valores de Google Sheets.",
      error,
    );
  }

  const variableIncome = variableIncomeFromSheets.map((item) => {
    const symbol = item.investment.symbol.trim().toUpperCase();
    const quote = marketPrices[symbol];
    const priceMXN = quote?.priceMXN;

    if (
      quote?.status !== "ok" ||
      typeof priceMXN !== "number" ||
      !Number.isFinite(priceMXN) ||
      priceMXN <= 0
    ) {
      console.warn(`Se conserva el precio de Google Sheets para ${symbol}.`);
      return item;
    }

    const currentValue = item.investment.quantity * priceMXN;

    console.log(`${symbol}: precio actualizado a MXN ${priceMXN.toFixed(2)}`);

    return {
      ...item,
      currentValue,
      investment: {
        ...item.investment,
        currentPrice: priceMXN,
      },
    };
  });

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

  const summary: PortfolioSummary = {
    invested,
    totalValue,
    totalGain: totalValue - invested,
    dailyChange: 0,
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
  };
}
