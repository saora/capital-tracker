import type { Currency } from "../types/investment";

const API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const MOVEMENTS_SHEET = "Movimientos";

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
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:H`));
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");

  const result = await sheetsRequest<{ values?: SheetRow[] }>(token, url.toString());
  const rows = result.values ?? [];

  return rows.slice(1).map((row) => {
    const categoryText = String(row[4] ?? "").trim().toLocaleLowerCase("es-MX");
    const typeText = String(row[2] ?? "").trim().toLocaleLowerCase("es-MX");
    return {
      id: String(row[0] ?? ""),
      date: parseSheetDate(row[1]),
      type: typeText === "salida" ? "Salida" : "Entrada",
      account: String(row[3] ?? "").trim(),
      category: categoryText.includes("accion") || categoryText.includes("invers")
        ? "Acciones"
        : "Cuenta bancaria",
      amount: parseAmount(row[5]),
      concept: String(row[6] ?? "").trim(),
      notes: String(row[7] ?? "").trim(),
      currency: "MXN" as Currency,
    };
  }).filter((movement) => movement.id && movement.date && movement.account)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function appendMovement(
  token: string,
  movement: Omit<Movement, "currency">,
): Promise<void> {
  const url = new URL(valuesUrl(`'${MOVEMENTS_SHEET}'!A:H`) + ":append");
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");

  await sheetsRequest(token, url.toString(), {
    method: "POST",
    body: JSON.stringify({
      majorDimension: "ROWS",
      values: [[
        movement.id,
        movement.date,
        movement.type,
        movement.account,
        movement.category,
        movement.amount,
        movement.concept,
        movement.notes,
      ]],
    }),
  });
}
