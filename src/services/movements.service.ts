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
  currency: Currency;
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
    throw new Error(`Google Sheets respondió ${response.status}: ${await response.text()}`);
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

export async function getMovements(token: string): Promise<Movement[]> {
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:N`));
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const result = await sheetsRequest<{ values?: SheetRow[] }>(token, url.toString());
  const rows = result.values ?? [];

  return rows.slice(1).map((row): Movement => {
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
      concept,
      notes: String(row[13] ?? "").trim(),
      quantity: row[9] === undefined || row[9] === "" ? undefined : parseAmount(row[9]),
      averageCost,
      currency: (String(row[7] ?? "MXN").trim() || "MXN") as Currency,
    };
  }).filter((movement) => movement.id && movement.date && movement.account)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function appendMovement(
  token: string,
  movement: Omit<Movement, "currency">,
): Promise<void> {
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:N`) + ":append");
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
        "MXN",                               // H: Moneda
        movement.concept === "Compra" || movement.concept === "Venta" ? movement.averageCost ?? "" : "", // I: Precio unitario
        movement.quantity ?? "",             // J: Titulos
        movement.averageCost ?? "",          // K: Costo promedio
        movement.amount,                     // L: Importe
        "",                                   // M: Comision (not collected by the form)
        movement.notes,                      // N: Notas
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
export async function updateMovement(token: string, movement: Omit<Movement, "currency">): Promise<void> {
  const row = await findMovementRow(token, movement.id);
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A${row}:N${row}`));
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
        "MXN",
        movement.concept === "Compra" || movement.concept === "Venta" ? movement.averageCost ?? "" : "",
        movement.quantity ?? "",
        movement.averageCost ?? "",
        movement.amount,
        "",
        movement.notes,
      ]],
    }),
  });
}
export async function deleteMovement(token: string, id: string): Promise<void> {
  const row = await findMovementRow(token, id);
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A${row}:N${row}`) + ":clear");
  await sheetsRequest(token, url.toString(), { method: "POST", body: JSON.stringify({}) });
}
