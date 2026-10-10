import type { ChartPoint } from '../types/portfolio';

const API_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const HISTORY_SHEET = 'Historial portafolio';
const HEADERS = ['Fecha', 'Capital invertido', 'Valor total', 'Ganancia acumulada'];

export interface PortfolioSnapshot {
  invested: number;
  totalValue: number;
  totalGain: number;
}

type SheetRow = Array<string | number | boolean | null>;

function getSpreadsheetId(): string {
  const id = import.meta.env.VITE_GOOGLE_SHEET_ID;

  if (!id) {
    throw new Error('Falta VITE_GOOGLE_SHEET_ID en .env.local.');
  }

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
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Google Sheets respondió ${response.status}: ${await response.text()}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readRows(token: string): Promise<SheetRow[]> {
  const url = new URL(valuesUrl(`'${HISTORY_SHEET}'!A:D`));
  url.searchParams.set('majorDimension', 'ROWS');
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');

  const result = await sheetsRequest<{ values?: SheetRow[] }>(
    token,
    url.toString(),
  );

  return result.values ?? [];
}

async function writeRange(
  token: string,
  range: string,
  values: SheetRow[],
): Promise<void> {
  const url = new URL(valuesUrl(range));
  url.searchParams.set('valueInputOption', 'RAW');

  await sheetsRequest(
    token,
    url.toString(),
    {
      method: 'PUT',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  );
}

async function ensureHistorySheet(token: string): Promise<void> {
  const metadataUrl = new URL(
    `${API_URL}/${encodeURIComponent(getSpreadsheetId())}`,
  );
  metadataUrl.searchParams.set('fields', 'sheets.properties.title');

  const metadata = await sheetsRequest<{
    sheets?: Array<{ properties?: { title?: string } }>;
  }>(token, metadataUrl.toString());

  const exists = metadata.sheets?.some(
    (sheet) => sheet.properties?.title === HISTORY_SHEET,
  );

  if (!exists) {
    await sheetsRequest(
      token,
      `${API_URL}/${encodeURIComponent(getSpreadsheetId())}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: HISTORY_SHEET,
                },
              },
            },
          ],
        }),
      },
    );
  }

  const rows = await readRows(token);

  if (
    rows.length === 0 ||
    HEADERS.some((header, index) => rows[0]?.[index] !== header)
  ) {
    await writeRange(token, `'${HISTORY_SHEET}'!A1:D1`, [HEADERS]);
  }
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function savePortfolioSnapshot(
  token: string,
  snapshot: PortfolioSnapshot,
): Promise<void> {
  await ensureHistorySheet(token);

  const rows = await readRows(token);
  const today = getLocalDateKey();

  const existingIndex = rows.findIndex(
    (row, index) =>
      index > 0 && String(row[0] ?? '').slice(0, 10) === today,
  );

  const values: SheetRow[] = [[
    today,
    snapshot.invested,
    snapshot.totalValue,
    snapshot.totalGain,
  ]];

  if (existingIndex >= 1) {
    const sheetRowNumber = existingIndex + 1;

    await writeRange(
      token,
      `'${HISTORY_SHEET}'!A${sheetRowNumber}:D${sheetRowNumber}`,
      values,
    );

    return;
  }

  const appendUrl = new URL(
    `${API_URL}/${encodeURIComponent(getSpreadsheetId())}/values/${encodeURIComponent(`'${HISTORY_SHEET}'!A:D`)}:append`,
  );
  appendUrl.searchParams.set('valueInputOption', 'RAW');
  appendUrl.searchParams.set('insertDataOption', 'INSERT_ROWS');

  await sheetsRequest(
    token,
    appendUrl.toString(),
    {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  );
}

export async function getPortfolioHistory(
  token: string,
): Promise<ChartPoint[]> {
  await ensureHistorySheet(token);

  const rows = await readRows(token);
  const points: ChartPoint[] = [];

  for (const row of rows.slice(1)) {
    const date = String(row[0] ?? '').slice(0, 10);
    const value = Number(row[2]);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      row[2] === '' ||
      row[2] == null ||
      !Number.isFinite(value)
    ) {
      continue;
    }

    points.push({
      date,
      label: date,
      value,
    });
  }

  return points.sort((a, b) =>
    (a.date ?? '').localeCompare(b.date ?? ''),
  );
}