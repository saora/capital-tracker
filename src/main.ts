import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './features/auth/session-header.css';
import './components/skeleton-loader/skeleton-loader.css';
import './features/auth/auth.css';
import './features/dashboard/dashboard.css';
import './components/asset-logo/asset-logo.css';
import './components/bottom-nav/bottom-nav.css';
import './main.css';

import { renderSkeletonLoader } from './components/skeleton-loader/skeleton-loader.template';
import { renderBottomNav } from './components/bottom-nav/bottom-nav';
import { initializeAssetLogoFallback } from './components/asset-logo/asset-logo';

import type { AppRoute } from './types/navigation';
import type { PerformancePeriod } from './types/portfolio';

import { renderDashboard } from './features/dashboard/dashboard';
import { renderPortfolio } from './features/portfolio/portfolio';
import { renderTransactions } from './features/transactions/transactions';
import { renderWatchlist } from './features/watchlist/watchlist';

import {
  endGoogleSession,
  getSessionAccessToken,
  renderAuthenticatedHeader,
  renderLoginView,
  startGoogleSession,
} from './features/auth/auth';

import { getInvestmentSheetsData } from './services/google-sheets.service';
import type { InvestmentSheetsData } from './services/google-sheets.service';

const appElement = document.querySelector<HTMLDivElement>('#app');

if (!appElement) {
  throw new Error('Application root element "#app" was not found.');
}

const app: HTMLDivElement = appElement;

initializeAssetLogoFallback(app);

let activeRoute: AppRoute = 'dashboard';
let activePeriod: PerformancePeriod = '1M';
let investmentData: InvestmentSheetsData | null = null;

let isConnecting = false;
let isAuthLoading = false;
let connectionError = '';

let touchStartY: number | null = null;
let pullDistance = 0;
let pullTracking = false;

const PULL_THRESHOLD = 75;

const validPeriods: PerformancePeriod[] = [
  '1W',
  '1M',
  '3M',
  '1Y',
  'ALL',
];

const validRoutes: AppRoute[] = [
  'dashboard',
  'portfolio',
  'transactions',
  'watchlist',
];

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
  if (!isConnecting && !connectionError) {
    return '';
  }

  if (connectionError) {
    return `
      <div class="pull-to-refresh-indicator is-error" role="alert">
        <span class="pull-to-refresh__label">
          ${escapeHtml(connectionError)}
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
        ${investmentData
          ? 'Actualizando datos...'
          : 'Cargando tu portafolio...'}
      </span>
    </div>
  `;
}

function renderPage(): void {
  // No mostrar las vistas privadas sin una sesión autenticada.
  if (!getSessionAccessToken()) {
    app.innerHTML = renderLoginView(
      connectionError,
      isAuthLoading,
    );
    return;
  }

  let pageHtml: string;

  // Mostrar skeletons durante la carga inicial de Google Sheets.
  // Si ya hay datos, conservar la vista actual durante las actualizaciones.
  const showInitialSkeleton =
    isConnecting && investmentData === null;

  switch (activeRoute) {
    case 'dashboard':
      pageHtml = showInitialSkeleton
        ? renderSkeletonLoader('dashboard')
        : renderDashboard(
            activePeriod,
            investmentData ?? undefined,
          );
      break;

    case 'portfolio':
      pageHtml = showInitialSkeleton
        ? renderSkeletonLoader('portfolio')
        : renderPortfolio(
            investmentData ?? undefined,
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
    ${renderBottomNav(activeRoute)}
  `;
}

async function connectGoogleSheets(
  accessToken?: string,
): Promise<void> {
  if (isConnecting) {
    return;
  }

  const token = accessToken ?? getSessionAccessToken();

  // No iniciar solicitudes si el usuario no tiene una sesión.
  if (!token) {
    renderPage();
    return;
  }

  isConnecting = true;
  connectionError = '';

  app.classList.remove('is-pulling');
  renderPage();

  try {
    investmentData = await getInvestmentSheetsData(token);
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible cargar los datos de Google Sheets.';
  } finally {
    isConnecting = false;
    renderPage();
  }
}

async function handleGoogleLogin(): Promise<void> {
  if (isAuthLoading) {
    return;
  }

  isAuthLoading = true;
  connectionError = '';
  renderPage();

  try {
    const accessToken = await startGoogleSession();

    isAuthLoading = false;

    // Reutilizar el token obtenido durante el inicio de sesión.
    await connectGoogleSheets(accessToken);
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible iniciar sesión con Google.';

    isAuthLoading = false;
    renderPage();
  }
}

async function handleGoogleLogout(): Promise<void> {
  if (isAuthLoading) {
    return;
  }

  isAuthLoading = true;
  connectionError = '';
  renderPage();

  try {
    await endGoogleSession();

    investmentData = null;
    activeRoute = 'dashboard';
    activePeriod = '1M';
    connectionError = '';
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible cerrar la sesión de Google.';
  } finally {
    isAuthLoading = false;
    renderPage();
  }
}

function getChartPoints(
  interaction: HTMLElement,
): HTMLButtonElement[] {
  return Array.from(
    interaction.querySelectorAll<HTMLButtonElement>(
      '.performance-chart__point',
    ),
  );
}

function selectChartPoint(
  selectedPoint: HTMLButtonElement,
): void {
  const interaction = selectedPoint.closest<HTMLElement>(
    '.performance-chart__interaction',
  );

  if (!interaction) {
    return;
  }

  getChartPoints(interaction).forEach((point) => {
    const isSelected = point === selectedPoint;

    point.classList.toggle(
      'performance-chart__point--selected',
      isSelected,
    );

    point.setAttribute('aria-pressed', String(isSelected));
  });
}

function selectNearestChartPoint(
  interaction: HTMLElement,
  clientX: number,
): void {
  const points = getChartPoints(interaction);

  if (points.length === 0) {
    return;
  }

  let nearestPoint = points[0];
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const rect = point.getBoundingClientRect();
    const pointCenterX = rect.left + rect.width / 2;
    const distance = Math.abs(clientX - pointCenterX);

    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestPoint = point;
    }
  }

  selectChartPoint(nearestPoint);
}

/* Pull to refresh: inicio del gesto */
app.addEventListener(
  'touchstart',
  (event: TouchEvent) => {
    if (!getSessionAccessToken()) {
      pullTracking = false;
      touchStartY = null;
      return;
    }

    if (event.touches.length !== 1) {
      pullTracking = false;
      touchStartY = null;
      return;
    }

    if (window.scrollY > 0 || isConnecting) {
      pullTracking = false;
      touchStartY = null;
      return;
    }

    touchStartY = event.touches[0].clientY;
    pullDistance = 0;
    pullTracking = true;
  },
  { passive: true },
);

/* Pull to refresh: seguimiento del desplazamiento */
app.addEventListener(
  'touchmove',
  (event: TouchEvent) => {
    if (!pullTracking || touchStartY === null) {
      return;
    }

    if (event.touches.length !== 1) {
      return;
    }

    const currentY = event.touches[0].clientY;
    pullDistance = currentY - touchStartY;

    if (pullDistance <= 0 || window.scrollY > 0) {
      app.classList.remove('is-pulling');
      return;
    }

    if (pullDistance > 8) {
      event.preventDefault();
      app.classList.add('is-pulling');

      const label = app.querySelector<HTMLElement>(
        '.pull-to-refresh__label',
      );

      if (label) {
        label.textContent =
          pullDistance >= PULL_THRESHOLD
            ? 'Suelta para actualizar'
            : 'Desliza hacia abajo para actualizar';
      }
    }
  },
  { passive: false },
);

/* Pull to refresh: soltar para actualizar */
function finishPullGesture(): void {
  const shouldRefresh =
    Boolean(getSessionAccessToken()) &&
    pullTracking &&
    pullDistance >= PULL_THRESHOLD &&
    window.scrollY <= 0 &&
    !isConnecting;

  pullTracking = false;
  touchStartY = null;
  pullDistance = 0;

  app.classList.remove('is-pulling');

  if (shouldRefresh) {
    void connectGoogleSheets();
  }
}

app.addEventListener(
  'touchend',
  finishPullGesture,
  { passive: true },
);

app.addEventListener(
  'touchcancel',
  () => {
    pullTracking = false;
    touchStartY = null;
    pullDistance = 0;
    app.classList.remove('is-pulling');
  },
  { passive: true },
);

/* Interacción con el gráfico */
app.addEventListener('pointermove', (event: PointerEvent) => {
  if (event.pointerType === 'touch' && event.buttons === 0) {
    return;
  }

  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const interaction = target.closest<HTMLElement>(
    '.performance-chart__interaction',
  );

  if (interaction) {
    selectNearestChartPoint(interaction, event.clientX);
  }
});

/* Navegación, autenticación y selección de controles */
app.addEventListener('click', (event: MouseEvent) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const authButton = target.closest<HTMLElement>(
    '[data-auth-action]',
  );

  if (authButton) {
    const action = authButton.dataset.authAction;

    if (action === 'login') {
      void handleGoogleLogin();
    } else if (action === 'logout') {
      void handleGoogleLogout();
    }

    return;
  }

  // Evitar interacciones con vistas privadas sin sesión.
  if (!getSessionAccessToken()) {
    return;
  }

  const chartPoint = target.closest<HTMLButtonElement>(
    '.performance-chart__point',
  );

  if (chartPoint) {
    selectChartPoint(chartPoint);
    return;
  }

  const periodButton = target.closest<HTMLElement>(
    '[data-period]',
  );

  if (periodButton) {
    const period = periodButton.dataset.period;

    if (
      period &&
      validPeriods.includes(period as PerformancePeriod)
    ) {
      activePeriod = period as PerformancePeriod;
      renderPage();
    }

    return;
  }

  const routeButton = target.closest<HTMLElement>(
    '[data-route]',
  );

  if (routeButton) {
    const route = routeButton.dataset.route;

    if (route && validRoutes.includes(route as AppRoute)) {
      activeRoute = route as AppRoute;
      renderPage();
    }
  }
});

/* Navegación por teclado del gráfico */
app.addEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target;

  if (
    !(target instanceof HTMLButtonElement) ||
    !target.matches('.performance-chart__point')
  ) {
    return;
  }

  const interaction = target.closest<HTMLElement>(
    '.performance-chart__interaction',
  );

  if (!interaction) {
    return;
  }

  const points = getChartPoints(interaction);
  const currentIndex = points.indexOf(target);

  if (currentIndex === -1) {
    return;
  }

  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowLeft':
      nextIndex = Math.max(0, currentIndex - 1);
      break;

    case 'ArrowRight':
      nextIndex = Math.min(
        points.length - 1,
        currentIndex + 1,
      );
      break;

    case 'Home':
      nextIndex = 0;
      break;

    case 'End':
      nextIndex = points.length - 1;
      break;

    default:
      return;
  }

  event.preventDefault();

  const nextPoint = points[nextIndex];
  nextPoint.focus();
  selectChartPoint(nextPoint);
});

/* Primera renderización: esperar a que el usuario inicie sesión. */
renderPage();