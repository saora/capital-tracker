
import { renderSkeletonLoader } from '../components/skeleton-loader/skeleton-loader.template';
import { renderBottomNav } from '../components/bottom-nav/bottom-nav';

import {
  renderAuthenticatedHeader,
  renderLoginView,
  getSessionAccessToken,
} from '../features/auth/auth';

import { renderDashboard } from '../features/dashboard/dashboard';
import { renderPortfolio } from '../features/portfolio/portfolio';
import { renderTransactions } from '../features/transactions/transactions';
import { renderWatchlist } from '../features/watchlist/watchlist';

import { appState } from './app-state';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

function renderRefreshIndicator(): string {
  if (!appState.isConnecting && !appState.connectionError) {
    return '';
  }

  if (appState.connectionError) {
    return `
      <div class="pull-to-refresh-indicator is-error" role="alert">
        <span class="pull-to-refresh__label">
          ${escapeHtml(appState.connectionError)}
        </span>
      </div>
    `;
  }

  return `
    <div
      class="pull-to-refresh-indicator is-refreshing"
      role="status"
      aria-live="polite"
    >
      <span
        class="pull-to-refresh__spinner"
        aria-hidden="true"
      ></span>
      <span class="pull-to-refresh__label">
        ${
          appState.investmentData
            ? 'Actualizando datos...'
            : 'Cargando tu portafolio...'
        }
      </span>
    </div>
  `;
}

export function renderPage(app: HTMLDivElement): void {
  if (!getSessionAccessToken()) {
    app.innerHTML = renderLoginView(
      appState.connectionError,
      appState.isAuthLoading,
    );
    return;
  }

  let pageHtml: string;

  const showInitialSkeleton =
    appState.isConnecting &&
    appState.investmentData === null;

  switch (appState.activeRoute) {
    case 'dashboard':
      pageHtml = showInitialSkeleton
        ? renderSkeletonLoader('dashboard')
        : renderDashboard(
            appState.activePeriod,
            appState.investmentData ?? undefined,
            appState.activeHoldingsCategory,
          );
      break;

    case 'portfolio':
      pageHtml = showInitialSkeleton
        ? renderSkeletonLoader('portfolio')
        : renderPortfolio(
            appState.investmentData ?? undefined,
          );
      break;

    case 'transactions':
      pageHtml = renderTransactions();
      break;

    case 'watchlist':
      pageHtml = renderWatchlist();
      break;
  }

  app.innerHTML = `
    ${renderAuthenticatedHeader()}
    ${renderRefreshIndicator()}
    ${pageHtml}
    ${renderBottomNav(appState.activeRoute)}
  `;
}
