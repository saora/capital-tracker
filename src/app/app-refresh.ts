import { getSessionAccessToken } from '../features/auth/auth';
import { getInvestmentSheetsData } from '../services/google-sheets.service';
import { getMovements } from '../services/movements.service';

import { appState } from './app-state';
import { renderPage } from './app-renderer';

export async function connectGoogleSheets(
  app: HTMLDivElement,
  accessToken?: string,
): Promise<void> {
  if (appState.isConnecting) return;

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
    const [investmentData, movements] = await Promise.all([
      getInvestmentSheetsData(token),
      getMovements(token),
    ]);
    appState.investmentData = investmentData;
    appState.movements = movements;
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
