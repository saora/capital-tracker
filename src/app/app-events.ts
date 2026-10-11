import type { AppRoute } from "../types/navigation";
import type { PerformancePeriod } from "../types/portfolio";

import { hasActiveAppSession } from "../features/auth/auth";

import {
  appState,
  PULL_THRESHOLD,
  validHoldingsCategories,
  validPeriods,
  validRoutes,
} from "./app-state";

import type { HoldingsCategory } from "./app-state";

import { renderPage } from "./app-renderer";
import { connectGoogleSheets } from "./app-refresh";
import { closeAccountMenu } from "./session-menu";

interface AppEventHandlers {
  onLogin: () => void;
  onLogout: () => void;
}

function getChartPoints(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-chart-point]"),
  );
}

function selectChartPoint(point: HTMLElement): void {
  const points = getChartPoints();

  points.forEach((item) => {
    const isSelected = item === point;

    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-pressed", String(isSelected));
  });

  const value = point.dataset.chartValue;
  const date = point.dataset.chartDate;

  const valueElement = document.querySelector<HTMLElement>(
    "[data-chart-selected-value]",
  );

  const dateElement = document.querySelector<HTMLElement>(
    "[data-chart-selected-date]",
  );

  if (valueElement && value !== undefined) {
    valueElement.textContent = value;
  }

  if (dateElement && date !== undefined) {
    dateElement.textContent = date;
  }
}

function selectNearestChartPoint(points: HTMLElement[], targetX: number): void {
  if (points.length === 0) return;

  const nearestPoint = points.reduce((nearest, current) => {
    const nearestRect = nearest.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();

    const nearestCenter = nearestRect.left + nearestRect.width / 2;
    const currentCenter = currentRect.left + currentRect.width / 2;

    return Math.abs(currentCenter - targetX) < Math.abs(nearestCenter - targetX)
      ? current
      : nearest;
  });

  selectChartPoint(nearestPoint);
}

function appStateHasSession(): boolean {
  return hasActiveAppSession();
}

export function initializeAppEvents(
  app: HTMLDivElement,
  handlers: AppEventHandlers,
): void {
  document.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (!target.closest(".session-menu")) {
      closeAccountMenu();
    }
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeAccountMenu();
    }
  });

  app.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const authActionElement = target.closest<HTMLElement>("[data-auth-action]");

    if (authActionElement) {
      const action = authActionElement.dataset.authAction;

      if (action === "login") {
        handlers.onLogin();
        return;
      }

      if (action === "logout") {
        handlers.onLogout();
        return;
      }
    }

    const actionElement = target.closest<HTMLElement>("[data-action]");

    if (actionElement) {
      const action = actionElement.dataset.action;

      if (action === "google-login") {
        handlers.onLogin();
        return;
      }

      if (action === "google-logout") {
        handlers.onLogout();
        return;
      }
    }

    if (!appStateHasSession()) return;

    const chartPoint = target.closest<HTMLElement>("[data-chart-point]");

    if (chartPoint) {
      selectChartPoint(chartPoint);
      return;
    }

    const categoryElement = target.closest<HTMLElement>(
      "[data-holdings-category]",
    );

    if (categoryElement) {
      const category = categoryElement.dataset.holdingsCategory as
        | HoldingsCategory
        | undefined;

      if (
        category &&
        validHoldingsCategories.includes(category) &&
        category !== appState.activeHoldingsCategory
      ) {
        appState.activeHoldingsCategory = category;
        renderPage(app);
      }

      return;
    }

    const periodElement = target.closest<HTMLElement>(
      "[data-performance-period]",
    );

    if (periodElement) {
      const period = periodElement.dataset.performancePeriod as
        | PerformancePeriod
        | undefined;

      if (
        period &&
        validPeriods.includes(period) &&
        period !== appState.activePeriod
      ) {
        appState.activePeriod = period;
        renderPage(app);
      }

      return;
    }

    const routeElement = target.closest<HTMLElement>("[data-route]");

    if (routeElement) {
      const route = routeElement.dataset.route as AppRoute | undefined;

      if (
        route &&
        validRoutes.includes(route) &&
        route !== appState.activeRoute
      ) {
        appState.activeRoute = route;
        renderPage(app);
      }
    }
  });

  app.addEventListener("pointermove", (event: PointerEvent) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const chart = target.closest<HTMLElement>("[data-chart-interactive]");

    if (!chart) return;

    const points = getChartPoints();

    if (points.length === 0) return;

    selectNearestChartPoint(points, event.clientX);
  });

  app.addEventListener("keydown", (event: KeyboardEvent) => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const currentPoint = target.closest<HTMLElement>("[data-chart-point]");

    if (!currentPoint) return;

    const points = getChartPoints();
    const currentIndex = points.indexOf(currentPoint);

    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      nextIndex = Math.min(points.length - 1, currentIndex + 1);
    } else {
      return;
    }

    event.preventDefault();

    const nextPoint = points[nextIndex];

    if (nextPoint) {
      selectChartPoint(nextPoint);
      nextPoint.focus();
    }
  });

  initializePullToRefresh(app);
}

function initializePullToRefresh(app: HTMLDivElement): void {
  app.addEventListener(
    "touchstart",
    (event: TouchEvent) => {
      if (!appStateHasSession() || appState.isConnecting) return;

      const touch = event.touches[0];

      if (!touch) return;

      const scrollContainer = document.querySelector<HTMLElement>(
        "[data-scroll-container]",
      );

      const scrollTop = scrollContainer?.scrollTop ?? window.scrollY;

      if (scrollTop > 0) return;

      appState.touchStartY = touch.clientY;
      appState.pullDistance = 0;
      appState.pullTracking = true;
    },
    { passive: true },
  );

  app.addEventListener(
    "touchmove",
    (event: TouchEvent) => {
      if (!appState.pullTracking || appState.touchStartY === null) return;

      const touch = event.touches[0];

      if (!touch) return;

      const distance = touch.clientY - appState.touchStartY;

      if (distance <= 0) {
        appState.pullDistance = 0;
        return;
      }

      appState.pullDistance = Math.min(distance * 0.5, 120);

      const indicator = app.querySelector<HTMLElement>(
        "[data-refresh-indicator]",
      );

      if (indicator) {
        indicator.style.transform = `translateY(${appState.pullDistance}px)`;
        indicator.style.opacity = String(
          Math.min(appState.pullDistance / PULL_THRESHOLD, 1),
        );
      }

      if (distance > 0 && event.cancelable) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  const finishPull = (): void => {
    const shouldRefresh =
      appState.pullTracking &&
      appState.pullDistance >= PULL_THRESHOLD &&
      appStateHasSession() &&
      !appState.isConnecting;

    appState.touchStartY = null;
    appState.pullTracking = false;
    appState.pullDistance = 0;

    if (shouldRefresh) {
      void connectGoogleSheets(app);
    } else {
      const indicator = app.querySelector<HTMLElement>(
        "[data-refresh-indicator]",
      );

      if (indicator) {
        indicator.style.transform = "";
        indicator.style.opacity = "";
      }
    }
  };

  app.addEventListener("touchend", finishPull, { passive: true });
  app.addEventListener("touchcancel", finishPull, { passive: true });
}
