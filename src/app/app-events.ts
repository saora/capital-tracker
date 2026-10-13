import type { AppRoute } from "../types/navigation";
import type { PerformancePeriod } from "../types/portfolio";

import { getSessionAccessToken } from "../features/auth/auth";

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
import { appendMovement, getMovements } from "../services/movements.service";
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

    item.classList.toggle("performance-chart__point--selected", isSelected);
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
  return Boolean(getSessionAccessToken());
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

    const movementPeriodElement = target.closest<HTMLElement>("[data-movement-period]");
    if (movementPeriodElement) {
      const period = movementPeriodElement.dataset.movementPeriod as "1D" | "1S" | "1M" | "1A" | undefined;
      if (period && ["1D", "1S", "1M", "1A"].includes(period) && period !== appState.movementPeriod) {
        appState.movementPeriod = period;
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

  app.addEventListener("change", (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== "category") return;

    const form = target.closest<HTMLFormElement>("#movement-form");
    if (!form) return;

    const category = target.value;
    const accountSelect = form.querySelector<HTMLSelectElement>("#movement-account");
    const accountLabel = form.querySelector<HTMLElement>("#movement-account-label");
    const conceptSelect = form.querySelector<HTMLSelectElement>('select[name="concept"]');
    const typeSelect = form.querySelector<HTMLSelectElement>('select[name="type"]');

    accountSelect?.querySelectorAll<HTMLOptGroupElement>("optgroup[data-account-category]").forEach((group) => {
      group.hidden = group.dataset.accountCategory !== category;
    });
    if (accountSelect) accountSelect.value = "";
    if (accountLabel) accountLabel.textContent = category === "Acciones" ? "Acción o activo" : "Cuenta bancaria";

    conceptSelect?.querySelectorAll<HTMLOptionElement>("option[data-movement-category]").forEach((option) => {
      option.hidden = option.dataset.movementCategory !== category;
    });
    if (conceptSelect) {
      const defaultConcept = category === "Acciones" ? "Compra" : "Depósito";
      conceptSelect.value = defaultConcept;
    }
    if (typeSelect) typeSelect.value = "Entrada";
  });

  app.addEventListener("change", (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.name !== "concept") return;

    const form = target.closest<HTMLFormElement>("#movement-form");
    const typeSelect = form?.querySelector<HTMLSelectElement>('select[name="type"]');
    if (!typeSelect) return;

    typeSelect.value = ["Depósito", "Compra", "Dividendo"].includes(target.value)
      ? "Entrada"
      : "Salida";
  });

  app.addEventListener("submit", (event: SubmitEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || target.id !== "movement-form") return;

    event.preventDefault();
    if (target.dataset.submitting === "true") return;

    const token = getSessionAccessToken();
    const status = target.querySelector<HTMLElement>("#movement-form-status");
    const submitButton = target.querySelector<HTMLButtonElement>('button[type="submit"]');
    const formData = new FormData(target);
    const date = String(formData.get("date") ?? "").trim();
    const category = String(formData.get("category") ?? "") as "Cuenta bancaria" | "Acciones";
    const type = String(formData.get("type") ?? "") as "Entrada" | "Salida";
    const account = String(formData.get("account") ?? "").trim();
    const concept = String(formData.get("concept") ?? "").trim();
    const amount = Number(formData.get("amount"));
    const notes = String(formData.get("notes") ?? "").trim();

    if (!token || !date || !account || !concept || !Number.isFinite(amount) || amount <= 0) {
      if (status) {
        status.textContent = "Revisa la fecha, la cuenta o activo, el concepto y el importe.";
        status.className = "movement-form__status movement-field--full is-error";
      }
      return;
    }

    target.dataset.submitting = "true";
    if (submitButton) submitButton.disabled = true;
    if (status) {
      status.textContent = "Guardando en Google Sheets…";
      status.className = "movement-form__status movement-field--full";
    }

    void (async () => {
      try {
        const savedMovement = {
          id: crypto.randomUUID(),
          date,
          type,
          account,
          category,
          amount,
          concept,
          notes,
          currency: "MXN" as const,
        };
        await appendMovement(token, savedMovement);
        appState.movements = [savedMovement, ...appState.movements]
          .sort((a, b) => b.date.localeCompare(a.date));
        try {
          appState.movements = await getMovements(token);
        } catch {
          // El append ya fue confirmado; conserva el registro local en pantalla.
        }
        renderPage(app);
        const successStatus = app.querySelector<HTMLElement>("#movement-form-status");
        if (successStatus) {
          successStatus.textContent = "Movimiento guardado correctamente.";
          successStatus.className = "movement-form__status movement-field--full is-success";
        }
      } catch (error) {
        target.dataset.submitting = "false";
        if (submitButton) submitButton.disabled = false;
        if (status) {
          status.textContent = error instanceof Error
            ? error.message
            : "No fue posible guardar el movimiento.";
          status.className = "movement-form__status movement-field--full is-error";
        }
      }
    })();
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
