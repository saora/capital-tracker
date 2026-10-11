
import { initializeAssetLogoFallback } from '../components/asset-logo/asset-logo';

import {
  endGoogleSession,
  getSessionAccessToken,
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
    appState.activeRoute = 'dashboard';
    appState.activePeriod = '1M';
    appState.activeHoldingsCategory = 'stocks';
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

  renderPage(app);

  // Conserva la sesión existente y carga los datos si ya hay token.
  if (getSessionAccessToken()) {
    void connectGoogleSheets(app);
  }
}

export { closeAccountMenu };
