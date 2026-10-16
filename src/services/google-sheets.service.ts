import { handleGoogleUnauthorized, signInWithGoogle } from "./google-auth.service";
import { createGoogleApiError, GoogleApiError } from "./google-api-error.service";
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
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("es-MX");
}

async function readRange(token: string, range: string): Promise<SheetRow[]> {
  const url = new URL(
    `${API_URL}/${encodeURIComponent(getSpreadsheetId())}/values/${encodeURIComponent(range)}`,
  );
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    handleGoogleUnauthorized(response.status);
    throw await createGoogleApiError(response);
  }

  const result = (await response.json()) as { values?: SheetRow[] };
  return result.values ?? [];
}

function getAssetType(symbol: string): AssetType {
  const normalized = normalize(symbol);
  if (normalized === "btc") return "crypto";
  if (["voo", "qqq", "ivvpeso", "ivvpesoishrs"].includes(normalized)) return "etf";
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
  // The requested banking capital/value is defined explicitly by D10:D15 / E10:E15.
  return rows
    .slice(1, 7)
    .map((row, index) => {
      const rawPlatform = String(row[2] ?? "").trim();
      const invested = toNumber(row[3]);
      const currentValue = toNumber(row[4]);
      if (invested === 0 && currentValue === 0) return null;
      // D10:D15 and E10:E15 are authoritative, even if a platform label is blank.
      const platform = rawPlatform || `Cuenta bancaria ${index + 1}`;

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

type MovementProvider = "GBM" | "BITSO";

function normalizeProvider(value: unknown): string {
  const raw = String(value ?? "").trim();
  const normalized = normalize(raw);
  if (normalized === "gbm") return "GBM";
  if (normalized === "bitso") return "BITSO";
  return raw;
}

function parsePortfolioControl(rows: SheetRow[]): Map<string, string> {
  const assetLocations = new Map<string, string>();
  rows.forEach((row) => {
    const symbol = normalize(row[0]);
    const location = normalizeProvider(row[1]);
    // Portfolio locations are used to classify current holdings, not to infer movement origins.
    if (symbol && location) assetLocations.set(symbol, location);
  });
  return assetLocations;
}

interface NetInvestmentBreakdown {
  GBM: number;
  BITSO: number;
  total: number;
}

/**
 * Capital para GBM y Bitso: suma únicamente movimientos con C = "Entrada"
 * y O (Origen) = "GBM" o "Bitso". Cada importe suma L (Importe) + M (Comisión).
 * No resta salidas, no infiere el origen desde Portfolio y no filtra por categoría.
 */
function calculateEntryInvestmentFromMovements(rows: SheetRow[]): NetInvestmentBreakdown {
  const entriesByProvider = new Map<MovementProvider, number>([
    ["GBM", 0],
    ["BITSO", 0],
  ]);

  rows.slice(1).forEach((row) => {
    if (normalize(row[2]) !== "entrada") return;

    const provider = normalizeProvider(row[14]);
    if (provider !== "GBM" && provider !== "BITSO") return;

    const amount = toNumber(row[11]);
    const commission = toNumber(row[12]);
    entriesByProvider.set(
      provider,
      (entriesByProvider.get(provider) ?? 0) + amount + commission,
    );
  });

  const GBM = entriesByProvider.get("GBM") ?? 0;
  const BITSO = entriesByProvider.get("BITSO") ?? 0;
  return { GBM, BITSO, total: GBM + BITSO };
}

function parseVariableIncome(
  rows: SheetRow[],
  activeAssets: Map<string, string>,
  portfolioControlRows: SheetRow[],
): ParsedInvestment[] {
  const activeSymbols = new Set(
    portfolioControlRows
      .filter((row) => normalize(row[2]) === "activo")
      .map((row) => normalize(row[0]))
      .filter(Boolean),
  );

  return rows
    .slice(1)
    .map((row, index) => {
      const symbol = String(row[0] ?? "").trim();
      const normalizedSymbol = normalize(symbol);
      const invested = toNumber(row[9]);
      const currentValue = toNumber(row[10]);
      const quantity = toNumber(row[7]);
      const dailyChangePercent = toNumber(row[4]) * 100;
      const location = activeAssets.get(normalizedSymbol);
      const provider = normalizeProvider(location);

      if (
        !symbol ||
        ["total", "total general", "subtotal"].includes(normalizedSymbol) ||
        !activeSymbols.has(normalizedSymbol) ||
        !["GBM", "BITSO"].includes(provider) ||
        quantity <= 0 ||
        (invested === 0 && currentValue === 0)
      ) {
        return null;
      }

      return {
        investment: {
          ...makeInvestment(
            `variable-${index}-${normalizedSymbol}`,
            symbol.toUpperCase(),
            symbol.toUpperCase(),
            getAssetType(symbol),
            invested,
            currentValue,
            quantity,
          ),
          location: provider,
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

  const [investmentRows, variableRows, portfolioControlRows, movementRows] = await Promise.all([
    readRange(token, "'Inversiones'!A9:J"),
    readRange(token, "'Renta variable'!A12:N27"),
    readRange(token, "'Portfolio'!A2:C"),
    readRange(token, "'Movimientos'!A1:O"),
  ]);

  const fixedIncome = parseFixedIncome(investmentRows);
  const activeAssets = parsePortfolioControl(portfolioControlRows);
  const movementEntryInvestment = calculateEntryInvestmentFromMovements(movementRows);
  // Current values and per-position gains must match the GBM/Bitso portfolio
  // data shown in Renta variable; Movimientos is used for net invested capital.
  const variableIncome = parseVariableIncome(variableRows, activeAssets, portfolioControlRows);

  const parsedInvestments = [...fixedIncome, ...variableIncome];
  if (parsedInvestments.length === 0) {
    throw new Error("No se encontraron posiciones. Verifica las hojas y sus columnas.");
  }

  const fixedIncomeInvested = investmentRows
    .slice(1, 7)
    .reduce((total, row) => total + toNumber(row[3]), 0);
  const invested = fixedIncomeInvested + movementEntryInvestment.total;

  // Build the summary from the same positions rendered by each portfolio tab.
  // Current values and gains come from Renta variable / Inversiones, not from
  // reconstructing today's holdings out of historic movement quantities.
  const bankValue = fixedIncome.reduce((total, item) => total + item.currentValue, 0);
  const gbmPositions = variableIncome.filter((item) => normalizeProvider(item.investment.location) === "GBM");
  const bitsoPositions = variableIncome.filter((item) => normalizeProvider(item.investment.location) === "BITSO");
  const gbmValue = gbmPositions.reduce((total, item) => total + item.currentValue, 0);
  const bitsoValue = bitsoPositions.reduce((total, item) => total + item.currentValue, 0);
  const totalValue = gbmValue + bitsoValue + bankValue;

  const gbmGain = gbmPositions.reduce((total, item) => total + item.currentValue - item.invested, 0);
  const bitsoGain = bitsoPositions.reduce((total, item) => total + item.currentValue - item.invested, 0);
  const bankGain = fixedIncome.reduce((total, item) => total + item.currentValue - item.invested, 0);
  const variableTotalGain = gbmGain + bitsoGain;
  const totalGain = gbmGain + bitsoGain + bankGain;

  const dailyChangeAmount = variableIncome.reduce((total, item) => {
    const dailyChangePercent = item.investment.dailyChangePercent;
    return typeof dailyChangePercent === "number" && Number.isFinite(dailyChangePercent)
      ? total + item.currentValue * (dailyChangePercent / 100)
      : total;
  }, 0);
  const dailyChange = totalValue > 0 ? (dailyChangeAmount / totalValue) * 100 : 0;

  const summary: PortfolioSummary = {
    invested,
    totalValue,
    totalGain,
    dailyChange,
    currency: "MXN",
  };

  console.table(parsedInvestments.map((item) => ({
    activo: item.investment.symbol,
    titulos: item.investment.quantity,
    costoVigente: item.invested,
    valorActual: item.currentValue,
    gananciaNoRealizada: item.currentValue - item.invested,
  })));
  console.log("DESGLOSE PATRIMONIO", {
    GBM: gbmValue,
    BITSO: bitsoValue,
    BANCO: bankValue,
    patrimonioEsperadoPorComponentes: gbmValue + bitsoValue + bankValue,
    patrimonioTotal: totalValue,
  });
  console.log("DESGLOSE CAPITAL INVERTIDO", {
    entradasGBM_ImporteMasComision: movementEntryInvestment.GBM,
    entradasBITSO_ImporteMasComision: movementEntryInvestment.BITSO,
    totalEntradasGBM_BITSO: movementEntryInvestment.total,
    capitalBancarioD10_D15: fixedIncomeInvested,
    capitalInvertido: invested,
  });
  console.log("DESGLOSE GANANCIA TOTAL", {
    gananciaGBM: gbmGain,
    gananciaBITSO: bitsoGain,
    gananciaBanco: bankGain,
    gananciaTotal: totalGain,
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
    if (error instanceof GoogleApiError && error.status === 429) throw error;
    console.warn("No se pudo guardar la captura del portafolio.", error);
  }

  try {
    historyPoints = await getPortfolioHistory(token);
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 429) throw error;
    console.warn("No se pudo leer el historial del portafolio.", error);
  }

  return {
    investments: parsedInvestments.map((item) => item.investment),
    summary,
    historyPoints,
    gainSummaryText: variableTotalGain.toFixed(2),
  };
}
