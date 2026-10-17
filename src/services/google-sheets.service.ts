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
  /** Net invested capital by brokerage, based only on Movimientos C/L/M/O. */
  netInvestedCapitalByProvider?: { GBM: number; BITSO: number };
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

interface ProviderTotals {
  GBM: number;
  BITSO: number;
  total: number;
}

interface NetInvestmentBreakdown extends ProviderTotals {
  entries: ProviderTotals;
  exits: ProviderTotals;
  exitCommissions: ProviderTotals;
}

/**
 * Capital neto invertido por plataforma.
 * Entrada: suma L (Importe) + M (Comisión).
 * Salida: resta L (Importe) menos M (Comisión), es decir, el efectivo neto retirado.
 * Solo considera C (Tipo) = Entrada/Salida y O (Origen) = GBM/Bitso.
 */
function calculateNetInvestmentFromMovements(rows: SheetRow[]): NetInvestmentBreakdown {
  const netByProvider = new Map<MovementProvider, number>([
    ["GBM", 0],
    ["BITSO", 0],
  ]);
  const entriesByProvider = new Map<MovementProvider, number>([
    ["GBM", 0],
    ["BITSO", 0],
  ]);
  const exitsByProvider = new Map<MovementProvider, number>([
    ["GBM", 0],
    ["BITSO", 0],
  ]);
  const exitCommissionsByProvider = new Map<MovementProvider, number>([
    ["GBM", 0],
    ["BITSO", 0],
  ]);

  rows.slice(1).forEach((row) => {
    const direction = normalize(row[2]);
    if (direction !== "entrada" && direction !== "salida") return;

    const provider = normalizeProvider(row[14]);
    if (provider !== "GBM" && provider !== "BITSO") return;

    const amount = toNumber(row[11]);
    const commission = toNumber(row[12]);

    if (direction === "entrada") {
      // Buying/investing increases capital by the amount plus its commission.
      entriesByProvider.set(
        provider,
        (entriesByProvider.get(provider) ?? 0) + amount + commission,
      );
      netByProvider.set(
        provider,
        (netByProvider.get(provider) ?? 0) + amount + commission,
      );
      return;
    }

    // A sale reduces capital by the sale amount; its commission is an invested cost.
    exitsByProvider.set(
      provider,
      (exitsByProvider.get(provider) ?? 0) + amount,
    );
    exitCommissionsByProvider.set(
      provider,
      (exitCommissionsByProvider.get(provider) ?? 0) + commission,
    );
    netByProvider.set(
      provider,
      (netByProvider.get(provider) ?? 0) - amount + commission,
    );
  });

  const GBM = netByProvider.get("GBM") ?? 0;
  const BITSO = netByProvider.get("BITSO") ?? 0;
  const entriesGBM = entriesByProvider.get("GBM") ?? 0;
  const entriesBITSO = entriesByProvider.get("BITSO") ?? 0;
  const exitsGBM = exitsByProvider.get("GBM") ?? 0;
  const exitsBITSO = exitsByProvider.get("BITSO") ?? 0;
  const exitCommissionsGBM = exitCommissionsByProvider.get("GBM") ?? 0;
  const exitCommissionsBITSO = exitCommissionsByProvider.get("BITSO") ?? 0;

  return {
    GBM,
    BITSO,
    total: GBM + BITSO,
    entries: {
      GBM: entriesGBM,
      BITSO: entriesBITSO,
      total: entriesGBM + entriesBITSO,
    },
    exits: {
      GBM: exitsGBM,
      BITSO: exitsBITSO,
      total: exitsGBM + exitsBITSO,
    },
    exitCommissions: {
      GBM: exitCommissionsGBM,
      BITSO: exitCommissionsBITSO,
      total: exitCommissionsGBM + exitCommissionsBITSO,
    },
  };
}

/**
 * Net number of titles per brokerage and investment from Movimientos.
 * Entrada + Compra adds titles; Salida + Venta subtracts them.
 * The brokerage and asset are both part of the key so identical tickers held
 * at GBM and Bitso are calculated independently.
 */
function calculateTitleQuantitiesFromMovements(rows: SheetRow[]): Map<string, number> {
  const quantities = new Map<string, number>();

  rows.slice(1).forEach((row) => {
    const direction = normalize(row[2]);
    const category = normalize(row[3]);
    const symbol = normalize(row[4]);
    const concept = normalize(row[5]);
    const quantity = toNumber(row[9]);
    const provider = normalizeProvider(row[14]);

    if (
      !symbol ||
      !category.includes("accion") ||
      (provider !== "GBM" && provider !== "BITSO") ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return;
    }

    const isPurchase = direction === "entrada" && concept === "compra";
    const isSale = direction === "salida" && concept === "venta";
    if (!isPurchase && !isSale) return;

    const key = `${provider}::${symbol}`;
    const signedQuantity = isPurchase ? quantity : -quantity;
    quantities.set(key, (quantities.get(key) ?? 0) + signedQuantity);
  });

  return quantities;
}

function getMovementTitleQuantity(
  quantities: Map<string, number>,
  provider: string,
  symbol: string,
): number | undefined {
  return quantities.get(`${normalizeProvider(provider)}::${normalize(symbol)}`);
}

function parseVariableIncome(
  rows: SheetRow[],
  activeAssets: Map<string, string>,
  portfolioControlRows: SheetRow[],
  movementTitleQuantities: Map<string, number>,
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
      const sheetQuantity = toNumber(row[7]);
      const dailyChangePercent = toNumber(row[4]) * 100;
      const location = activeAssets.get(normalizedSymbol);
      const provider = normalizeProvider(location);
      // Movimientos is authoritative whenever this investment has recorded buys/sells.
      // Keep the sheet quantity only for legacy holdings with no matching movement history.
      const quantity =
        getMovementTitleQuantity(movementTitleQuantities, provider, symbol) ?? sheetQuantity;

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
  const movementNetInvestment = calculateNetInvestmentFromMovements(movementRows);
  const movementTitleQuantities = calculateTitleQuantitiesFromMovements(movementRows);
  // Market values still come from Renta variable; title counts come from Movimientos
  // whenever buy/sell history exists for the GBM/Bitso investment.
  const variableIncome = parseVariableIncome(
    variableRows,
    activeAssets,
    portfolioControlRows,
    movementTitleQuantities,
  );

  const parsedInvestments = [...fixedIncome, ...variableIncome];
  if (parsedInvestments.length === 0) {
    throw new Error("No se encontraron posiciones. Verifica las hojas y sus columnas.");
  }

  const fixedIncomeInvested = investmentRows
    .slice(1, 7)
    .reduce((total, row) => total + toNumber(row[3]), 0);
  const invested = fixedIncomeInvested + movementNetInvestment.total;

  // Build the summary from the same positions rendered by each portfolio tab.
  // Current values and gains come from Renta variable / Inversiones, not from
  // reconstructing today's holdings out of historic movement quantities.
  const bankValue = fixedIncome.reduce((total, item) => total + item.currentValue, 0);
  const gbmPositions = variableIncome.filter((item) => normalizeProvider(item.investment.location) === "GBM");
  const bitsoPositions = variableIncome.filter((item) => normalizeProvider(item.investment.location) === "BITSO");
  const gbmValue = gbmPositions.reduce((total, item) => total + item.currentValue, 0);
  const bitsoValue = bitsoPositions.reduce((total, item) => total + item.currentValue, 0);
  const totalValue = gbmValue + bitsoValue + bankValue;

  // Brokerage gains compare current market values against each provider's net invested capital.
  const gbmGain = gbmValue - movementNetInvestment.GBM;
  const bitsoGain = bitsoValue - movementNetInvestment.BITSO;
  const bankGain = bankValue - fixedIncomeInvested;
  const variableTotalGain = gbmGain + bitsoGain;
  // Home's total gain must reconcile exactly to total wealth minus total invested capital.
  const totalGain = totalValue - invested;

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
    entradasGBM_ImporteMasComision: movementNetInvestment.entries.GBM,
    salidasGBM_Importe: movementNetInvestment.exits.GBM,
    comisionesSalidasGBM: movementNetInvestment.exitCommissions.GBM,
    capitalNetoGBM: movementNetInvestment.GBM,
    entradasBITSO_ImporteMasComision: movementNetInvestment.entries.BITSO,
    salidasBITSO_Importe: movementNetInvestment.exits.BITSO,
    comisionesSalidasBITSO: movementNetInvestment.exitCommissions.BITSO,
    capitalNetoBITSO: movementNetInvestment.BITSO,
    capitalNetoGBM_BITSO: movementNetInvestment.total,
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
    netInvestedCapitalByProvider: {
      GBM: movementNetInvestment.GBM,
      BITSO: movementNetInvestment.BITSO,
    },
    historyPoints,
    gainSummaryText: variableTotalGain.toFixed(2),
  };
}
