
import { initializeAssetLogoFallback } from '../components/asset-logo/asset-logo';

import {
  endGoogleSession,
  getSessionAccessToken,
  isActiveAccessTokenExpired,
  expireGoogleSession,
  startGoogleSession,
} from '../features/auth/auth';

import { appState } from './app-state';
import { renderPage } from './app-renderer';
import { connectGoogleSheets } from './app-refresh';
import { initializeAppEvents } from './app-events';

function closeAccountMenu(): void {
  document
    .querySelectorAll<HTMLDetailsElement>('.session-menu[open]')
    .forEach((menu) => {
      menu.open = false;
    });
}

export async function handleGoogleLogin(
  app: HTMLDivElement,
): Promise<void> {
  if (appState.isAuthLoading) {
    return;
  }

  appState.isAuthLoading = true;
  appState.connectionError = '';
  renderPage(app);

  try {
    const accessToken = await startGoogleSession();

    appState.isAuthLoading = false;
    await connectGoogleSheets(app, accessToken);
  } catch (error) {
    appState.connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible iniciar sesión con Google.';

    appState.isAuthLoading = false;
    renderPage(app);
  }
}

export async function handleGoogleLogout(
  app: HTMLDivElement,
): Promise<void> {
  if (appState.isAuthLoading) {
    return;
  }

  appState.isAuthLoading = true;
  appState.connectionError = '';

  closeAccountMenu();
  renderPage(app);

  try {
    await endGoogleSession();

    appState.investmentData = null;
    appState.movements = [];
    appState.catalog = [];
    appState.activeRoute = 'dashboard';
    appState.activePeriod = '1M';
    appState.connectionError = '';
  } catch (error) {
    appState.connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible cerrar la sesión de Google.';
  } finally {
    appState.isAuthLoading = false;
    renderPage(app);
  }
}

const MIN_BACKGROUND_REFRESH_INTERVAL_MS = 60_000;

export function initializeApp(app: HTMLDivElement): void {
  initializeAssetLogoFallback(app);

  initializeAppEvents(app, {
    onLogin: () => {
      void handleGoogleLogin(app);
    },
    onLogout: () => {
      void handleGoogleLogout(app);
    },
  });

  window.addEventListener('google-session-expired', () => {
    appState.investmentData = null;
    appState.movements = [];
    appState.catalog = [];
    appState.activeRoute = 'dashboard';
    appState.activePeriod = '1M';
    appState.connectionError = 'Tu sesión ha expirado. Inicia sesión nuevamente.';
    appState.isAuthLoading = false;
    appState.isConnecting = false;
    closeAccountMenu();
    renderPage(app);
  });

  renderPage(app);

  // Conserva la sesión existente y carga los datos cada vez que arranca la app.
  if (getSessionAccessToken()) {
    void connectGoogleSheets(app);
  }

  // Refresh when the user returns to the app/tab after leaving it in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !getSessionAccessToken()) {
      return;
    }

    // Avoid re-reading several Sheets ranges when the user quickly returns to the app.
    if (
      appState.lastSuccessfulRefreshAt !== null &&
      Date.now() - appState.lastSuccessfulRefreshAt < MIN_BACKGROUND_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    // Do not make protected API requests with a token that is already expired.
    if (isActiveAccessTokenExpired()) {
      expireGoogleSession();
      return;
    }

    if (!appState.isConnecting) {
      void connectGoogleSheets(app);
    }
  });
}

export { closeAccountMenu };
