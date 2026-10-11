
import {
  getSessionAccessToken,
  hasActiveAppSession,
} from '../features/auth/auth';

import {
  validatePasskeySession,
} from '../services/passkey-auth.service';

import {
  getInvestmentSheetsData,
} from '../services/google-sheets.service';

import { appState } from './app-state';
import { renderPage } from './app-renderer';

export async function connectGoogleSheets(
  app: HTMLDivElement,
  accessToken?: string,
): Promise<void> {
  if (appState.isConnecting) {
    return;
  }

  const token = accessToken ?? getSessionAccessToken();

  if (!token || !hasActiveAppSession()) {
    renderPage(app);
    return;
  }

  appState.isConnecting = true;
  appState.connectionError = '';

  app.classList.remove('is-pulling');
  renderPage(app);

  try {
    const isValidSession = await validatePasskeySession();

    if (!isValidSession) {
      appState.investmentData = null;
      appState.connectionError =
        'Tu sesión de seguridad expiró. Inicia sesión nuevamente.';
      return;
    }

    appState.investmentData =
      await getInvestmentSheetsData(token);
  } catch (error) {
    appState.connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible cargar los datos de Google Sheets.';
  } finally {
    appState.isConnecting = false;
    renderPage(app);
  }
}
