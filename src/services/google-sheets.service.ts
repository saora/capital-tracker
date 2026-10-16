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

interface MovementPosition {
  symbol: string;
  provider: MovementProvider;
  quantity: number;
  costBasis: number;
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
      const platform = String(row[2] ?? "").trim();
      const invested = toNumber(row[3]);
      const currentValue = toNumber(row[4]);
      if (!platform || (invested === 0 && currentValue === 0)) return null;

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

function resolveMovementProvider(
  origin: unknown,
  symbol: string,
  assetLocations: Map<string, string>,
): MovementProvider | undefined {
  const explicit = normalizeProvider(origin);
  if (explicit === "GBM" || explicit === "BITSO") return explicit;

  const fallback = normalizeProvider(assetLocations.get(normalize(symbol)));
  if (fallback === "GBM" || fallback === "BITSO") return fallback;
  return undefined;
}

function parsePortfolioControl(rows: SheetRow[]): Map<string, string> {
  const assetLocations = new Map<string, string>();
  rows.forEach((row) => {
    const symbol = normalize(row[0]);
    const location = normalizeProvider(row[1]);
    // Keep historical locations too, so older movements without an O:Origen value
    // can still be attributed to the provider currently recorded for that symbol.
    if (symbol && location) assetLocations.set(symbol, location);
  });
  return assetLocations;
}

/**
 * Reads current quotes from Renta variable and derives quantities/remaining
 * cost basis from Movimientos, with each position assigned to its broker.
 */
function parseCurrentPrices(rows: SheetRow[]): Map<string, { price: number; dailyChangePercent: number }> {
  const prices = new Map<string, { price: number; dailyChangePercent: number }>();
  rows.slice(1).forEach((row) => {
    const symbol = String(row[0] ?? "").trim();
    const currentValue = toNumber(row[10]);
    const quantity = toNumber(row[7]);
    if (!symbol || quantity <= 0 || currentValue <= 0) return;
    prices.set(normalize(symbol), {
      price: currentValue / quantity,
      dailyChangePercent: toNumber(row[4]) * 100,
    });
  });
  return prices;
}

function parseMovementPositions(
  rows: SheetRow[],
  assetLocations: Map<string, string>,
): Map<string, MovementPosition> {
  const sorted = rows.slice(1)
    .filter((row) => String(row[0] ?? "").trim() && String(row[4] ?? "").trim())
    .map((row) => {
      const symbol = String(row[4] ?? "").trim();
      return {
        id: String(row[0] ?? "").trim(),
        date: String(row[1] ?? ""),
        direction: normalize(row[2]),
        type: normalize(row[3]),
        symbol,
        provider: resolveMovementProvider(row[14], symbol, assetLocations),
        concept: normalize(row[5]),
        quantity: toNumber(row[9]),
        amount: toNumber(row[11]),
        commission: toNumber(row[12]),
      };
    })
    .filter((row) => row.type.includes("accion") || row.type.includes("invers"))
    .sort((a, b) => a.date.localeCompare(b.date));

  const positions = new Map<string, MovementPosition>();

  for (const movement of sorted) {
    if (!movement.provider) {
      throw new Error(
        `El movimiento ${movement.id} (${movement.symbol}) no tiene origen GBM/Bitso y no se puede asignar a un portafolio. Completa la columna O (Origen) de "Movimientos" o la ubicación en "Portfolio".`,
      );
    }
    const key = `${movement.provider}:${normalize(movement.symbol)}`;
    const current = positions.get(key) ?? {
      symbol: movement.symbol.toUpperCase(),
      provider: movement.provider,
      quantity: 0,
      costBasis: 0,
    };
    const quantity = Math.max(0, movement.quantity);

    if (movement.direction === "entrada") {
      if (movement.concept === "compra" && quantity > 0) {
        current.costBasis += movement.amount + movement.commission;
        current.quantity += quantity;
      }
    } else if (movement.direction === "salida" && quantity > 0) {
      if (movement.concept === "venta" && current.quantity > 0) {
        const soldQuantity = Math.min(quantity, current.quantity);
        const averageCost = current.costBasis / current.quantity;
        const allocatedCost = averageCost * soldQuantity;
        current.costBasis = Math.max(0, current.costBasis - allocatedCost);
        current.quantity = Math.max(0, current.quantity - soldQuantity);
      } else {
        const removedQuantity = Math.min(quantity, current.quantity);
        const averageCost = current.quantity > 0 ? current.costBasis / current.quantity : 0;
        current.costBasis = Math.max(0, current.costBasis - averageCost * removedQuantity);
        current.quantity = Math.max(0, current.quantity - removedQuantity);
      }
    }

    positions.set(key, current);
  }

  return positions;
}

/**
 * Capital variable neto = entradas menos salidas de GBM y Bitso.
 * Las comisiones de compra aumentan el capital aportado y las de venta
 * reducen el efectivo recuperado.
 */
interface NetInvestmentBreakdown {
  GBM: number;
  BITSO: number;
  total: number;
}

function calculateNetInvestmentFromMovements(
  rows: SheetRow[],
  assetLocations: Map<string, string>,
): NetInvestmentBreakdown {
  const netByProvider = new Map<MovementProvider, number>([
    ["GBM", 0],
    ["BITSO", 0],
  ]);
  const unassigned: string[] = [];

  rows.slice(1).forEach((row) => {
    const type = normalize(row[3]);
    if (!type.includes("accion") && !type.includes("invers")) return;

    const id = String(row[0] ?? "").trim();
    const symbol = String(row[4] ?? "").trim();
    if (!id || !symbol) return;
    const provider = resolveMovementProvider(row[14], symbol, assetLocations);
    if (!provider) {
      unassigned.push(`${id} (${symbol})`);
      return;
    }

    const direction = normalize(row[2]);
    const amount = toNumber(row[11]);
    const commission = toNumber(row[12]);
    const signedAmount = direction === "entrada"
      ? amount + commission
      : direction === "salida"
        ? -(amount - commission)
        : 0;
    netByProvider.set(provider, (netByProvider.get(provider) ?? 0) + signedAmount);
  });

  if (unassigned.length > 0) {
    throw new Error(
      `Hay movimientos de inversión sin origen GBM/Bitso: ${unassigned.slice(0, 5).join(", ")}. Completa la columna O (Origen) de "Movimientos" para poder calcular el capital invertido correctamente.`,
    );
  }

  const GBM = netByProvider.get("GBM") ?? 0;
  const BITSO = netByProvider.get("BITSO") ?? 0;
  return { GBM, BITSO, total: GBM + BITSO };
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
  const currentPrices = parseCurrentPrices(variableRows);
  const netVariableInvestment = calculateNetInvestmentFromMovements(movementRows, activeAssets);
  const movementPositions = parseMovementPositions(movementRows, activeAssets);

  const variableIncome: ParsedInvestment[] = [...movementPositions.values()]
    .filter((position) => position.quantity > 0.0000001)
    .map((position) => {
      const market = currentPrices.get(normalize(position.symbol));
      if (!market) {
        throw new Error(
          `No hay precio actual disponible para ${position.symbol} en "Renta variable". No se puede calcular el valor del portafolio con seguridad.`,
        );
      }

      const invested = position.costBasis;
      const currentValue = position.quantity * market.price;
      const location = position.provider;

      return {
        investment: {
          ...makeInvestment(
            `movement-${normalize(position.symbol)}`,
            position.symbol,
            position.symbol,
            getAssetType(position.symbol),
            invested,
            currentValue,
            position.quantity,
          ),
          location,
          dailyChangePercent: market.dailyChangePercent,
        },
        invested,
        currentValue,
      };
    });

  const parsedInvestments = [...fixedIncome, ...variableIncome];
  if (parsedInvestments.length === 0) {
    throw new Error("No se encontraron posiciones. Verifica las hojas y sus columnas.");
  }

  const fixedIncomeInvested = investmentRows
    .slice(1, 7)
    .reduce((total, row) => total + toNumber(row[3]), 0);
  const invested = fixedIncomeInvested + netVariableInvestment.total;
  const totalValue = parsedInvestments.reduce((total, item) => total + item.currentValue, 0);
  // Match the gains displayed in the GBM, Bitso and bank portfolios:
  // unrealized gains for open stock positions + accrued bank/fixed-income gains.
  const variableTotalGain = variableIncome.reduce(
    (total, item) => total + item.currentValue - item.invested,
    0,
  );
  const fixedIncomeGain = fixedIncome.reduce(
    (total, item) => total + item.currentValue - item.invested,
    0,
  );
  const totalGain = variableTotalGain + fixedIncomeGain;

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
  console.log("RESUMEN CALCULADO", {
    capitalRentaFija: fixedIncomeInvested,
    capitalNetoGBM: netVariableInvestment.GBM,
    capitalNetoBitso: netVariableInvestment.BITSO,
    capitalInvertido: invested,
    patrimonioTotal: totalValue,
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
