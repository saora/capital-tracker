import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';

import './features/dashboard/dashboard.css';
import './components/asset-logo/asset-logo.css';
import './components/bottom-nav/bottom-nav.css';
import './main.css';

import { renderBottomNav } from './components/bottom-nav/bottom-nav';
import { initializeAssetLogoFallback } from './components/asset-logo/asset-logo';

import type { AppRoute } from './types/navigation';
import type { PerformancePeriod } from './types/portfolio';

import { renderDashboard } from './features/dashboard/dashboard';
import { renderPortfolio } from './features/portfolio/portfolio';
import { renderTransactions } from './features/transactions/transactions';
import { renderWatchlist } from './features/watchlist/watchlist';

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
let connectionError = '';

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

function renderConnectionPanel(): string {
  const connected = investmentData !== null;

  const status = isConnecting
    ? 'Conectando con Google Sheets…'
    : connected
      ? 'Conectado · Datos de Google Sheets'
      : 'Conecta tu hoja para cargar tu portafolio real.';

  const errorHtml = connectionError
    ? `<p class="google-connection__error" role="alert">${escapeHtml(connectionError)}</p>`
    : '';

  return `
    <section class="google-connection card" aria-label="Conexión con Google Sheets">
      <div class="google-connection__content">
        <p class="text-secondary">Fuente de datos</p>
        <p class="google-connection__status" role="status">${status}</p>
        ${errorHtml}
      </div>
      <button
        class="google-connection__button"
        type="button"
        data-connect-google
        ${isConnecting ? 'disabled' : ''}
      >
        ${isConnecting ? 'Conectando…' : connected ? 'Actualizar datos' : 'Conectar Google Sheets'}
      </button>
    </section>
  `;
}

function renderPage(): void {
  let pageHtml: string;

  switch (activeRoute) {
    case 'dashboard':
      pageHtml = renderDashboard(activePeriod, investmentData ?? undefined);
      break;

    case 'portfolio':
      pageHtml = renderPortfolio(investmentData ?? undefined);
      break;

    case 'transactions':
      pageHtml = renderTransactions();
      break;

    case 'watchlist':
      pageHtml = renderWatchlist();
      break;
  }

  app.innerHTML = `
    ${renderConnectionPanel()}
    ${pageHtml}
    ${renderBottomNav(activeRoute)}
  `;
}

async function connectGoogleSheets(): Promise<void> {
  if (isConnecting) return;

  isConnecting = true;
  connectionError = '';

  // Start the OAuth request directly from the user's click.
  const request = getInvestmentSheetsData();

  renderPage();

  try {
    investmentData = await request;
  } catch (error) {
    connectionError =
      error instanceof Error
        ? error.message
        : 'No fue posible conectar con Google Sheets.';
  } finally {
    isConnecting = false;
    renderPage();
  }
}

function getChartPoints(interaction: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    interaction.querySelectorAll<HTMLButtonElement>(
      '.performance-chart__point',
    ),
  );
}

function selectChartPoint(selectedPoint: HTMLButtonElement): void {
  const interaction = selectedPoint.closest<HTMLElement>(
    '.performance-chart__interaction',
  );

  if (!interaction) return;

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

  if (points.length === 0) return;

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

app.addEventListener('pointermove', (event: PointerEvent) => {
  if (event.pointerType === 'touch' && event.buttons === 0) return;

  const target = event.target;

  if (!(target instanceof Element)) return;

  const interaction = target.closest<HTMLElement>(
    '.performance-chart__interaction',
  );

  if (interaction) {
    selectNearestChartPoint(interaction, event.clientX);
  }
});

app.addEventListener('click', (event: MouseEvent) => {
  const target = event.target;

  if (!(target instanceof Element)) return;

  const connectButton = target.closest<HTMLButtonElement>(
    '[data-connect-google]',
  );

  if (connectButton) {
    void connectGoogleSheets();
    return;
  }

  const chartPoint = target.closest<HTMLButtonElement>(
    '.performance-chart__point',
  );

  if (chartPoint) {
    selectChartPoint(chartPoint);
    return;
  }

  const periodButton = target.closest<HTMLElement>('[data-period]');

  if (periodButton) {
    const period = periodButton.dataset.period;

    if (period && validPeriods.includes(period as PerformancePeriod)) {
      activePeriod = period as PerformancePeriod;
      renderPage();
    }

    return;
  }

  const routeButton = target.closest<HTMLElement>('[data-route]');

  if (routeButton) {
    const route = routeButton.dataset.route;

    if (route && validRoutes.includes(route as AppRoute)) {
      activeRoute = route as AppRoute;
      renderPage();
    }
  }
});

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

  if (!interaction) return;

  const points = getChartPoints(interaction);
  const currentIndex = points.indexOf(target);

  if (currentIndex === -1) return;

  let nextIndex = currentIndex;

  switch (event.key) {
    case 'ArrowLeft':
      nextIndex = Math.max(0, currentIndex - 1);
      break;
    case 'ArrowRight':
      nextIndex = Math.min(points.length - 1, currentIndex + 1);
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

renderPage();