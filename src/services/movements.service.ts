import { handleGoogleUnauthorized } from "./google-auth.service";
import { createGoogleApiError } from "./google-api-error.service";
import type { Currency } from "../types/investment";

const API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const MOVEMENTS_SHEET = "Movimientos";
const CATALOG_SHEET = "Catalogo";

export type CatalogAssetType = "Banco" | "ETF" | "Crypto" | "Accion";
export interface CatalogAsset {
  name: string;
  type: CatalogAssetType;
}

export async function getCatalog(token: string): Promise<CatalogAsset[]> {
  const url = new URL(valuesUrl(`'${CATALOG_SHEET}'!A:B`));
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  const result = await sheetsRequest<{ values?: SheetRow[] }>(token, url.toString());
  const rows = result.values ?? [];
  const allowedTypes = new Map<string, CatalogAssetType>([
    ["banco", "Banco"],
    ["etf", "ETF"],
    ["crypto", "Crypto"],
    ["cripto", "Crypto"],
    ["accion", "Accion"],
    ["acción", "Accion"],
  ]);

  return rows.slice(1).map((row) => {
    const name = String(row[0] ?? "").trim();
    const rawType = String(row[1] ?? "").trim().toLocaleLowerCase("es-MX");
    return { name, type: allowedTypes.get(rawType) };
  }).filter((item): item is CatalogAsset => Boolean(item.name && item.type))
    .filter((item, index, all) =>
      all.findIndex((candidate) =>
        candidate.name.toLocaleLowerCase("es-MX") === item.name.toLocaleLowerCase("es-MX") &&
        candidate.type === item.type
      ) === index
    )
    .sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
}

export type MovementCategory = "Cuenta bancaria" | "Acciones";
export type MovementType = "Entrada" | "Salida";
export type MovementOrigin = "GBM" | "Bitso";

export interface Movement {
  id: string;
  date: string;
  type: MovementType;
  account: string;
  category: MovementCategory;
  amount: number;
  concept: string;
  notes: string;
  quantity?: number;
  averageCost?: number;
  commission?: number;
  currency: Currency;
  origin?: MovementOrigin;
  /** Derived from chronological purchases and sales; never stored in Google Sheets. */
  realizedGain?: number;
  realizedCostBasis?: number;
  realizedNetProceeds?: number;
  realizedGainStatus?: "calculated" | "insufficient-history";
}

type SheetRow = Array<string | number | boolean | null>;

function getSpreadsheetId(): string {
  const id = import.meta.env.VITE_GOOGLE_SHEET_ID;
  if (!id) throw new Error("Falta VITE_GOOGLE_SHEET_ID en .env.local.");
  return id;
}

function valuesUrl(range: string): string {
  return `${API_URL}/${encodeURIComponent(getSpreadsheetId())}/values/${encodeURIComponent(range)}`;
}

async function sheetsRequest<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    handleGoogleUnauthorized(response.status);
    throw await createGoogleApiError(response);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseSheetDate(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

interface MovementWithSourceOrder {
  movement: Movement;
  sourceOrder: number;
}

interface AverageCostLedger {
  quantity: number;
  totalCost: number;
  reliable: boolean;
}

function normalizeMovementKey(value: string | undefined): string {
  return String(value ?? "").trim().toLocaleUpperCase("es-MX");
}

/**
 * Calculates realized gain at sale time using weighted-average cost.
 * Purchase cost includes its commission; sale proceeds are reduced by the sale commission.
 * If recorded purchases do not cover the sold quantity, the gain is left uncalculated
 * rather than inventing a cost basis.
 */
function calculateRealizedGains(movements: Movement[]): Movement[] {
  const enriched = movements.map((movement) => ({ ...movement }));
  const chronological: MovementWithSourceOrder[] = movements
    .map((movement, sourceOrder) => ({ movement, sourceOrder }))
    .sort((a, b) =>
      a.movement.date.localeCompare(b.movement.date) ||
      a.sourceOrder - b.sourceOrder,
    );

  const ledgers = new Map<string, AverageCostLedger>();

  chronological.forEach(({ movement, sourceOrder }) => {
    const result = enriched[sourceOrder];
    if (movement.category !== "Acciones") return;

    const concept = movement.concept.trim().toLocaleLowerCase("es-MX");
    const isPurchase = movement.type === "Entrada" && concept === "compra";
    const isSale = movement.type === "Salida" && concept === "venta";
    if (!isPurchase && !isSale) return;

    const quantity = movement.quantity;
    const amount = movement.amount;
    const commission = movement.commission ?? 0;
    const origin = normalizeMovementKey(movement.origin);
    const asset = normalizeMovementKey(movement.account);
    const currency = normalizeMovementKey(movement.currency);

    if (!asset || !origin || !currency) {
      if (isSale) result.realizedGainStatus = "insufficient-history";
      return;
    }

    const key = [origin, asset, currency].join("::");
    let ledger = ledgers.get(key);
    if (!ledger) {
      ledger = { quantity: 0, totalCost: 0, reliable: true };
      ledgers.set(key, ledger);
    }

    if (isPurchase) {
      if (
        typeof quantity !== "number" ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(commission) ||
        commission < 0 ||
        !ledger.reliable
      ) {
        ledger.reliable = false;
        return;
      }

      ledger.quantity += quantity;
      ledger.totalCost += amount + commission;
      return;
    }

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(commission) ||
      commission < 0 ||
      !ledger.reliable ||
      ledger.quantity + 1e-8 < quantity
    ) {
      result.realizedGainStatus = "insufficient-history";
      ledger.reliable = false;
      return;
    }

    const averageCostPerShare = ledger.totalCost / ledger.quantity;
    const costBasis = averageCostPerShare * quantity;
    const netProceeds = amount - commission;
    const realizedGain = netProceeds - costBasis;

    result.realizedGain = realizedGain;
    result.realizedCostBasis = costBasis;
    result.realizedNetProceeds = netProceeds;
    result.realizedGainStatus = "calculated";

    ledger.quantity -= quantity;
    ledger.totalCost -= costBasis;
    if (ledger.quantity < 1e-8) {
      ledger.quantity = 0;
      ledger.totalCost = 0;
    }
  });

  return enriched;
}

export async function getMovements(token: string): Promise<Movement[]> {
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:O`));
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const result = await sheetsRequest<{ values?: SheetRow[] }>(token, url.toString());
  const rows = result.values ?? [];

  const movements = rows.slice(1).map((row): Movement => {
    const directionText = String(row[2] ?? "").trim().toLocaleLowerCase("es-MX");
    const movementCategory = String(row[3] ?? "").trim().toLocaleLowerCase("es-MX");
    const concept = String(row[5] ?? "").trim();
    const unitPrice = row[8] === undefined || row[8] === "" ? undefined : parseAmount(row[8]);
    const averageCost = row[10] === undefined || row[10] === "" ? unitPrice : parseAmount(row[10]);
    return {
      id: String(row[0] ?? ""),
      date: parseSheetDate(row[1]),
      type: directionText === "salida" ? "Salida" : "Entrada",
      account: String(row[4] ?? "").trim(),
      category: movementCategory.includes("accion") || movementCategory.includes("invers")
        ? "Acciones"
        : "Cuenta bancaria",
      amount: parseAmount(row[11]),
      commission: row[12] === undefined || row[12] === "" ? undefined : parseAmount(row[12]),
      concept,
      notes: String(row[13] ?? "").trim(),
      quantity: row[9] === undefined || row[9] === "" ? undefined : parseAmount(row[9]),
      averageCost,
      currency: (String(row[7] ?? "MXN").trim() || "MXN") as Currency,
      origin: ["GBM", "Bitso"].includes(String(row[14] ?? "").trim())
        ? String(row[14]).trim() as MovementOrigin
        : undefined,
    };
  }).filter((movement) => movement.id && movement.date && movement.account);

  return calculateRealizedGains(movements)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function appendMovement(
  token: string,
  movement: Omit<Movement, "currency"> & { currency?: Currency },
): Promise<void> {
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:O`) + ":append");
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");

  await sheetsRequest(token, url.toString(), {
    method: "POST",
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: [[
        movement.id,                         // A: Id
        movement.date,                       // B: Fecha
        movement.type,                       // C: Categoria (Entrada/Salida)
        movement.category,                   // D: Tipo (Cuenta bancaria/Acciones)
        movement.account,                    // E: Cuenta o Activo
        movement.concept,                    // F: Concepto
        "",                                   // G: Cantidad (not collected separately by the form)
        movement.currency ?? "MXN",           // H: Moneda
        movement.concept === "Compra" || movement.concept === "Venta" ? movement.averageCost ?? "" : "", // I: Precio unitario
        movement.quantity ?? "",             // J: Titulos
        movement.averageCost ?? "",          // K: Costo promedio
        movement.amount,                     // L: Importe
        movement.commission ?? "",           // M: Comision
        movement.notes,                      // N: Notas
        movement.origin ?? "",                // O: Origen
      ]],
    }),
  });
}


async function findMovementRow(token: string, id: string): Promise<number> {
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:A`));
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  const result = await sheetsRequest<{ values?: SheetRow[] }>(token, url.toString());
  const index = (result.values ?? []).findIndex((row, i) => i > 0 && String(row[0] ?? "") === id);
  if (index < 1) throw new Error("No se encontró el movimiento en Google Sheets.");
  return index + 1;
}
export async function updateMovement(token: string, movement: Omit<Movement, "currency"> & { currency?: Currency }): Promise<void> {
  const row = await findMovementRow(token, movement.id);
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A${row}:O${row}`));
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  await sheetsRequest(token, url.toString(), {
    method: "PUT",
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: [[
        movement.id,
        movement.date,
        movement.type,
        movement.category,
        movement.account,
        movement.concept,
        "",
        movement.currency ?? "MXN",
        movement.concept === "Compra" || movement.concept === "Venta" ? movement.averageCost ?? "" : "",
        movement.quantity ?? "",
        movement.averageCost ?? "",
        movement.amount,
        movement.commission ?? "",
        movement.notes,
        movement.origin ?? "",
      ]],
    }),
  });
}
export async function deleteMovement(token: string, id: string): Promise<void> {
  const row = await findMovementRow(token, id);
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A${row}:O${row}`) + ":clear");
  await sheetsRequest(token, url.toString(), { method: "POST", body: JSON.stringify({}) });
}
