
import { initializeAssetLogoFallback } from '../components/asset-logo/asset-logo';

import {
  endGoogleSession,
  startGoogleSession,
  startPasskeySession,
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

    await startPasskeySession(accessToken);

    appState.isAuthLoading = false;

    await connectGoogleSheets(app, accessToken);
  } catch (error) {
    appState.connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible completar la autenticación.';

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
        : 'No fue posible cerrar la sesión.';
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
}

export { closeAccountMenu };
