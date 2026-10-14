import { getSessionAccessToken } from '../features/auth/auth';
import {
  GoogleApiError,
  GOOGLE_SHEETS_RATE_LIMIT_MESSAGE,
} from '../services/google-api-error.service';
import { getInvestmentSheetsData } from '../services/google-sheets.service';
import { getCatalog, getMovements } from '../services/movements.service';

import { appState } from './app-state';
import { renderPage } from './app-renderer';

export async function connectGoogleSheets(
  app: HTMLDivElement,
  accessToken?: string,
): Promise<void> {
  if (appState.isConnecting) return;

  const now = Date.now();
  if (appState.googleSheetsRetryAfter !== null) {
    if (now < appState.googleSheetsRetryAfter) {
      appState.connectionError = GOOGLE_SHEETS_RATE_LIMIT_MESSAGE;
      renderPage(app);
      return;
    }

    appState.googleSheetsRetryAfter = null;
    appState.connectionError = '';
  }

  const token = accessToken ?? getSessionAccessToken();
  if (!token) {
    renderPage(app);
    return;
  }

  appState.isConnecting = true;
  appState.connectionError = '';
  app.classList.remove('is-pulling');
  renderPage(app);

  try {
    const [investmentData, movements, catalog] = await Promise.all([
      getInvestmentSheetsData(token),
      getMovements(token),
      getCatalog(token),
    ]);
    appState.investmentData = investmentData;
    appState.movements = movements;
    appState.catalog = catalog;
    appState.lastSuccessfulRefreshAt = Date.now();
    appState.googleSheetsRetryAfter = null;
    appState.connectionError = '';
  } catch (error) {
    // A 401 invalidates the session synchronously; do not replace the login
    // screen's session-expired state with a stale request error.
    if (getSessionAccessToken()) {
      if (error instanceof GoogleApiError && error.status === 429) {
        appState.googleSheetsRetryAfter = Date.now() + error.retryAfterMs;
        appState.connectionError = GOOGLE_SHEETS_RATE_LIMIT_MESSAGE;
        console.warn('Google Sheets alcanzó el límite de solicitudes.', error.technicalMessage);
      } else {
        appState.connectionError =
          error instanceof Error
            ? error.message
            : 'No fue posible cargar los datos de Google Sheets.';
      }
    }
  } finally {
    appState.isConnecting = false;
    renderPage(app);
  }
}
