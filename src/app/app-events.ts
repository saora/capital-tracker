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
import { appendMovement, deleteMovement, getMovements, updateMovement } from "../services/movements.service";
import { closeAccountMenu } from "./session-menu";

interface AppEventHandlers {
  onLogin: () => void;
  onLogout: () => void;
}

function getChartPoints(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-chart-point]"));
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
  const valueElement = document.querySelector<HTMLElement>("[data-chart-selected-value]");
  const dateElement = document.querySelector<HTMLElement>("[data-chart-selected-date]");
  if (valueElement && value !== undefined) valueElement.textContent = value;
  if (dateElement && date !== undefined) dateElement.textContent = date;
}

function selectNearestChartPoint(points: HTMLElement[], targetX: number): void {
  if (points.length === 0) return;
  const nearestPoint = points.reduce((nearest, current) => {
    const nearestRect = nearest.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const nearestCenter = nearestRect.left + nearestRect.width / 2;
    const currentCenter = currentRect.left + currentRect.width / 2;
    return Math.abs(currentCenter - targetX) < Math.abs(nearestCenter - targetX) ? current : nearest;
  });
  selectChartPoint(nearestPoint);
}

function appStateHasSession(): boolean {
  return Boolean(getSessionAccessToken());
}

function getMovementFormValues(form: HTMLFormElement): string {
  return Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"))
    .map((field) => {
      const value = field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox") ? String(field.checked) : field.value;
      return [field.name, value, String(field.disabled), String(field.required)].join(":");
    }).join("|");
}

function updateMovementSubmitState(form: HTMLFormElement): void {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!submit || form.dataset.submitting === "true") return;
  const isValid = form.checkValidity();
  const isEditing = Boolean(form.dataset.editId);
  const hasChanged = !isEditing || getMovementFormValues(form) !== form.dataset.originalValues;
  submit.disabled = !isValid || !hasChanged;
}

function getInvestmentDirection(concept: string): "Entrada" | "Salida" {
  return ["Compra", "Dividendo"].includes(concept) ? "Entrada" : "Salida";
}

function parseNumericInput(value: string): number {
  const normalized = value.trim().replace(/[$\s,]/g, "");
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function formatCurrencyInput(input: HTMLInputElement): void {
  const value = parseNumericInput(input.value);
  if (!Number.isFinite(value)) {
    input.value = "";
    return;
  }
  input.value = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

const investmentConcepts = [
  { value: "Compra", label: "Compra", direction: "Entrada" },
  { value: "Venta", label: "Venta", direction: "Salida" },
  { value: "Dividendo", label: "Dividendo", direction: "Entrada" },
  { value: "Comisión", label: "Comisión", direction: "Salida" },
  { value: "Otro", label: "Otro", direction: "all" },
] as const;

function updateInvestmentConceptOptions(form: HTMLFormElement, direction: "Entrada" | "Salida", preferred?: string): void {
  const select = form.querySelector<HTMLSelectElement>('select[name="concept"]');
  if (!select) return;
  const category = form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value;
  const bankOptions = Array.from(select.options).filter((option) => option.dataset.movementCategory === "Cuenta bancaria");

  // Rebuild the options instead of relying on option[hidden], which is inconsistently
  // honored by native select menus in some browsers.
  select.replaceChildren(...bankOptions);
  if (category === "Acciones") {
    const allowed = investmentConcepts.filter((item) => item.direction === direction || item.direction === "all");
    allowed.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      option.dataset.movementCategory = "Acciones";
      option.dataset.movementDirection = item.direction;
      select.append(option);
    });
    const current = preferred ?? select.value;
    select.value = allowed.some((item) => item.value === current) ? current : (direction === "Entrada" ? "Compra" : "Venta");
  } else {
    bankOptions.forEach((option) => { option.hidden = false; });
    select.value = preferred && bankOptions.some((option) => option.value === preferred) ? preferred : (bankOptions[0]?.value ?? "");
  }
}

function updatePurchaseAmount(form: HTMLFormElement): void {
  const category = form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value;
  const concept = form.querySelector<HTMLSelectElement>('select[name="concept"]')?.value;
  if (category !== "Acciones" || concept !== "Compra") return;
  const quantity = Number(form.querySelector<HTMLInputElement>('input[name="quantity"]')?.value);
  const averageInput = form.querySelector<HTMLInputElement>('input[name="averageCost"]');
  const averageCost = averageInput ? parseNumericInput(averageInput.value) : Number.NaN;
  const amountInput = form.querySelector<HTMLInputElement>('input[name="amount"]');
  if (!amountInput || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(averageCost) || averageCost <= 0) return;
  amountInput.value = (quantity * averageCost).toFixed(2);
  amountInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function updateInvestmentFields(form: HTMLFormElement, category: string, concept: string): void {
  const isInvestment = category === "Acciones";
  form.querySelectorAll<HTMLElement>("[data-field-concept]").forEach((field) => {
    const concepts = (field.dataset.fieldConcept ?? "").split(",");
    const visible = isInvestment && concepts.includes(concept);
    field.hidden = !visible;
    field.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.disabled = !visible;
      input.required = visible;
      if (!visible) input.value = "";
    });
  });
}

export function initializeAppEvents(app: HTMLDivElement, handlers: AppEventHandlers): void {
  document.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".session-menu")) closeAccountMenu();
  });
  document.addEventListener("keydown", (event: KeyboardEvent) => { if (event.key === "Escape") closeAccountMenu(); });
  app.addEventListener("click", (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const authActionElement = target.closest<HTMLElement>("[data-auth-action]");
    if (authActionElement) {
      const action = authActionElement.dataset.authAction;
      if (action === "login") { handlers.onLogin(); return; }
      if (action === "logout") { handlers.onLogout(); return; }
    }
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (actionElement) {
      const action = actionElement.dataset.action;
      if (action === "google-login") { handlers.onLogin(); return; }
      if (action === "google-logout") { handlers.onLogout(); return; }
    }
    if (!appStateHasSession()) return;
    const chartPoint = target.closest<HTMLElement>("[data-chart-point]");
    if (chartPoint) { selectChartPoint(chartPoint); return; }
    const categoryElement = target.closest<HTMLElement>("[data-holdings-category]");
    if (categoryElement) {
      const category = categoryElement.dataset.holdingsCategory as HoldingsCategory | undefined;
      if (category && validHoldingsCategories.includes(category) && category !== appState.activeHoldingsCategory) { appState.activeHoldingsCategory = category; renderPage(app); }
      return;
    }
    const periodElement = target.closest<HTMLElement>("[data-performance-period]");
    if (periodElement) {
      const period = periodElement.dataset.performancePeriod as PerformancePeriod | undefined;
      if (period && validPeriods.includes(period) && period !== appState.activePeriod) { appState.activePeriod = period; renderPage(app); }
      return;
    }
    const movementFormToggle = target.closest<HTMLButtonElement>("[data-movement-form-toggle]");
    if (movementFormToggle) {
      const form = app.querySelector<HTMLFormElement>("#movement-form");
      const formCard = app.querySelector<HTMLElement>("#movement-form-card");
      if (form && formCard) {
        delete form.dataset.editId; delete form.dataset.confirmedSave; delete form.dataset.submitting; delete form.dataset.originalValues;
        form.reset();
        form.querySelectorAll<HTMLOptionElement>("option[data-movement-temporary]").forEach((option) => option.remove());
        form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.dispatchEvent(new Event("change", { bubbles: true }));
        form.querySelector<HTMLSelectElement>('select[name="concept"]')?.dispatchEvent(new Event("change", { bubbles: true }));
        updateMovementSubmitState(form);
        const title = formCard.querySelector<HTMLElement>("#movement-form-title"); if (title) title.textContent = "Registrar movimiento";
        const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]'); if (submit) submit.textContent = "Guardar movimiento";
        const cancel = form.querySelector<HTMLButtonElement>("[data-movement-cancel]"); if (cancel) cancel.hidden = true;
        const status = form.querySelector<HTMLElement>("#movement-form-status"); if (status) { status.textContent = ""; status.className = "movement-form__status movement-field--full"; }
        formCard.hidden = false; movementFormToggle.hidden = true;
        const history = app.querySelector<HTMLElement>("#movement-history-section"); if (history) history.hidden = true;
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
        formCard.querySelector<HTMLElement>("#movement-form-title")?.focus({ preventScroll: true });
      }
      return;
    }
    const closeSuccessToast = target.closest<HTMLButtonElement>("[data-movement-success-close]");
    if (closeSuccessToast) {
      const toast = closeSuccessToast.closest<HTMLElement>("#movement-success-toast");
      if (toast) { const timer = Number(toast.dataset.hideTimer); if (timer) window.clearTimeout(timer); delete toast.dataset.hideTimer; toast.hidden = true; }
      return;
    }
    const expandMovement = target.closest<HTMLButtonElement>("[data-movement-expand]");
    if (expandMovement) {
      const row = expandMovement.closest<HTMLElement>("[data-movement-row]"); const detail = row?.querySelector<HTMLElement>("[data-movement-detail]");
      if (row && detail) {
        const opening = detail.hidden === true;
        if (opening) app.querySelectorAll<HTMLElement>("[data-movement-row]").forEach((otherRow) => {
          if (otherRow === row) return;
          const otherDetail = otherRow.querySelector<HTMLElement>("[data-movement-detail]"); const otherButton = otherRow.querySelector<HTMLButtonElement>("[data-movement-expand]");
          if (otherDetail) otherDetail.hidden = true; otherRow.classList.remove("is-expanded"); otherButton?.setAttribute("aria-expanded", "false");
        });
        detail.hidden = !opening; row.classList.toggle("is-expanded", opening); expandMovement.setAttribute("aria-expanded", String(opening));
        if (opening) { detail.scrollIntoView({ behavior: "smooth", block: "nearest" }); detail.focus({ preventScroll: true }); }
      }
      return;
    }
    const cancelEdit = target.closest<HTMLButtonElement>("[data-movement-cancel]");
    if (cancelEdit) {
      const form = app.querySelector<HTMLFormElement>("#movement-form"); const card = app.querySelector<HTMLElement>("#movement-form-card"); const add = app.querySelector<HTMLButtonElement>("[data-movement-form-toggle]");
      if (form) { delete form.dataset.editId; form.reset(); } if (card) card.hidden = true; if (add) add.hidden = false; renderPage(app); return;
    }
    const editButton = target.closest<HTMLButtonElement>("[data-movement-edit]");
    if (editButton) {
      const movement = appState.movements.find((item) => item.id === editButton.dataset.movementEdit); const form = app.querySelector<HTMLFormElement>("#movement-form"); const card = app.querySelector<HTMLElement>("#movement-form-card"); const add = app.querySelector<HTMLButtonElement>("[data-movement-form-toggle]");
      if (!movement || !form || !card) { window.alert("No se encontró la información de este movimiento. Actualiza el historial e inténtalo de nuevo."); return; }
      form.reset(); form.dataset.editId = movement.id;
      const categoryRadio = form.querySelector<HTMLInputElement>(`input[name="category"][value="${movement.category}"]`);
      if (categoryRadio) { categoryRadio.checked = true; categoryRadio.dispatchEvent(new Event("change", { bubbles: true })); }
      const directionRadio = form.querySelector<HTMLInputElement>(`input[name="type"][value="${movement.type}"]`); if (directionRadio) directionRadio.checked = true;
      updateInvestmentConceptOptions(form, movement.type, movement.concept);
      const conceptSelect = form.querySelector<HTMLSelectElement>('select[name="concept"]'); if (conceptSelect) conceptSelect.dispatchEvent(new Event("change", { bubbles: true }));
      const dateInput = form.querySelector<HTMLInputElement>('input[name="date"]'); const amountInput = form.querySelector<HTMLInputElement>('input[name="amount"]'); const notesInput = form.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
      const accountSelect = form.querySelector<HTMLSelectElement>(movement.category === "Acciones" ? "#movement-asset" : "#movement-account");
      if (dateInput) dateInput.value = movement.date;
      if (accountSelect) {
        if (!Array.from(accountSelect.options).some((option) => option.value === movement.account)) { const option = document.createElement("option"); option.value = movement.account; option.textContent = movement.account; option.dataset.movementTemporary = "true"; accountSelect.append(option); }
        accountSelect.value = movement.account; accountSelect.disabled = false; accountSelect.required = true;
      }
      if (amountInput) amountInput.value = String(movement.amount); if (notesInput) notesInput.value = movement.notes;
      const quantity = form.querySelector<HTMLInputElement>('input[name="quantity"]'); const average = form.querySelector<HTMLInputElement>('input[name="averageCost"]');
      const needsQuantity = movement.category === "Acciones" && ["Compra", "Venta"].includes(movement.concept); const needsAverage = movement.category === "Acciones" && movement.concept === "Compra";
      if (quantity) { quantity.value = movement.quantity === undefined ? "" : String(movement.quantity); quantity.disabled = !needsQuantity; quantity.required = needsQuantity; quantity.closest<HTMLElement>("[data-field-concept]")!.hidden = !needsQuantity; }
      if (average) { average.value = movement.averageCost === undefined ? "" : String(movement.averageCost); average.disabled = !needsAverage; average.required = needsAverage; average.closest<HTMLElement>("[data-field-concept]")!.hidden = !needsAverage; }
      card.querySelector<HTMLElement>("#movement-form-title")!.textContent = "Editar movimiento"; form.querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent = "Guardar cambios"; form.querySelector<HTMLButtonElement>("[data-movement-cancel]")!.hidden = false;
      form.dataset.originalValues = getMovementFormValues(form); updateMovementSubmitState(form);
      const status = form.querySelector<HTMLElement>("#movement-form-status"); if (status) { status.textContent = ""; status.className = "movement-form__status movement-field--full"; }
      card.hidden = false; if (add) add.hidden = true; const history = app.querySelector<HTMLElement>("#movement-history-section"); if (history) history.hidden = true; card.scrollIntoView({ behavior: "smooth", block: "start" }); dateInput?.focus({ preventScroll: true }); return;
    }
    const deleteButton = target.closest<HTMLButtonElement>("[data-movement-delete]");
    if (deleteButton) {
      const id = deleteButton.dataset.movementDelete; const dialog = app.querySelector<HTMLDialogElement>("#movement-action-dialog"); const confirmButton = dialog?.querySelector<HTMLButtonElement>("[data-movement-action-confirm]");
      if (!id || !dialog || !confirmButton) return;
      dialog.dataset.action = "delete"; dialog.dataset.movementId = id; app.querySelector<HTMLElement>("#movement-action-title")!.textContent = "Eliminar movimiento"; app.querySelector<HTMLElement>("#movement-action-message")!.textContent = "¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."; confirmButton.textContent = "Eliminar"; confirmButton.classList.remove("button--primary"); confirmButton.classList.add("button--danger"); confirmButton.disabled = false; if (!dialog.open) dialog.showModal(); return;
    }
    const cancelAction = target.closest<HTMLButtonElement>("[data-movement-action-cancel]"); if (cancelAction) { app.querySelector<HTMLDialogElement>("#movement-action-dialog")?.close(); return; }
    const confirmAction = target.closest<HTMLButtonElement>("[data-movement-action-confirm]");
    if (confirmAction) {
      const dialog = confirmAction.closest<HTMLDialogElement>("#movement-action-dialog"); if (!dialog) return;
      const action = dialog.dataset.action;
      if (action === "save") { dialog.close(); const form = app.querySelector<HTMLFormElement>("#movement-form"); if (form) { form.dataset.confirmedSave = "true"; form.requestSubmit(); } return; }
      const id = dialog.dataset.movementId; const token = getSessionAccessToken(); if (action !== "delete" || !id) return; confirmAction.disabled = true;
      void (async () => { try { if (!token) throw new Error("La sesión de Google expiró. Vuelve a iniciar sesión."); await deleteMovement(token, id); appState.movements = appState.movements.filter((item) => item.id !== id); dialog.close(); renderPage(app); showMovementSuccess(app, "Movimiento eliminado correctamente."); } catch (error) { confirmAction.disabled = false; window.alert(error instanceof Error ? error.message : "No fue posible eliminar el movimiento."); } })(); return;
    }
    const movementPeriodElement = target.closest<HTMLElement>("[data-movement-period]");
    if (movementPeriodElement) { const period = movementPeriodElement.dataset.movementPeriod as "1D" | "1S" | "1M" | "1A" | undefined; if (period && ["1D", "1S", "1M", "1A"].includes(period) && period !== appState.movementPeriod) { appState.movementPeriod = period; renderPage(app); } return; }
    const routeElement = target.closest<HTMLElement>("[data-route]");
    if (routeElement) { const route = routeElement.dataset.route as AppRoute | undefined; if (route && validRoutes.includes(route) && route !== appState.activeRoute) { appState.activeRoute = route; renderPage(app); } }
  });

  app.addEventListener("pointermove", (event: PointerEvent) => {
    const target = event.target; if (!(target instanceof Element)) return; const chart = target.closest<HTMLElement>("[data-chart-interactive]"); if (!chart) return; const points = getChartPoints(); if (points.length === 0) return; selectNearestChartPoint(points, event.clientX);
  });
  app.addEventListener("keydown", (event: KeyboardEvent) => {
    const target = event.target; if (!(target instanceof Element)) return; const currentPoint = target.closest<HTMLElement>("[data-chart-point]"); if (!currentPoint) return; const points = getChartPoints(); const currentIndex = points.indexOf(currentPoint); if (currentIndex === -1) return;
    let nextIndex = currentIndex; if (event.key === "ArrowLeft") nextIndex = Math.max(0, currentIndex - 1); else if (event.key === "ArrowRight") nextIndex = Math.min(points.length - 1, currentIndex + 1); else return;
    event.preventDefault(); const nextPoint = points[nextIndex]; if (nextPoint) { selectChartPoint(nextPoint); nextPoint.focus(); }
  });
  app.addEventListener("input", (event: Event) => {
    const target = event.target; if (!(target instanceof HTMLTextAreaElement) || target.name !== "notes") return; const form = target.closest<HTMLFormElement>("#movement-form"); const counter = form?.querySelector<HTMLElement>("[data-notes-counter]"); if (counter) counter.textContent = `${String(target.value.length).padStart(2, "0")}/30`;
  });
  app.addEventListener("input", (event: Event) => {
    const target = event.target; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return; const form = target.closest<HTMLFormElement>("#movement-form"); if (!form) return;
    if (target instanceof HTMLInputElement && target.matches("[data-currency-input]")) { const start = target.selectionStart; const cleaned = target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); if (cleaned !== target.value) target.value = cleaned; if (start !== null) target.setSelectionRange(Math.min(start, target.value.length), Math.min(start, target.value.length)); }
    if (target.name === "quantity") { target.value = target.value.replace(/[^0-9].*$/, ""); updatePurchaseAmount(form); } if (target.name === "averageCost") updatePurchaseAmount(form); updateMovementSubmitState(form);
  });
  app.addEventListener("change", (event: Event) => {
    const target = event.target; if (!(target instanceof HTMLInputElement) || target.name !== "category") return; const form = target.closest<HTMLFormElement>("#movement-form"); if (!form) return; const category = target.value;
    form.querySelectorAll<HTMLElement>("[data-field-category]").forEach((field) => {
      const categories = field.dataset.fieldCategory ?? "all"; const visible = categories === "all" || categories === category; field.hidden = !visible;
      field.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((input) => { if (input.name === "date" || input.name === "amount" || input.name === "notes" || input.name === "concept") return; input.disabled = !visible; if (!visible) input.required = false; });
    });
    const bankSelect = form.querySelector<HTMLSelectElement>("#movement-account"); const assetSelect = form.querySelector<HTMLSelectElement>("#movement-asset");
    if (bankSelect) { bankSelect.disabled = category !== "Cuenta bancaria"; bankSelect.required = category === "Cuenta bancaria"; bankSelect.value = ""; }
    if (assetSelect) { assetSelect.disabled = category !== "Acciones"; assetSelect.required = category === "Acciones"; assetSelect.value = ""; }
    const conceptSelect = form.querySelector<HTMLSelectElement>('select[name="concept"]');
    if (category === "Acciones") { const entryRadio = form.querySelector<HTMLInputElement>('input[name="type"][value="Entrada"]'); if (entryRadio) entryRadio.checked = true; updateInvestmentConceptOptions(form, "Entrada", "Compra"); }
    else updateInvestmentConceptOptions(form, "Entrada", "Depósito");
    updateInvestmentFields(form, category, conceptSelect?.value ?? ""); updateMovementSubmitState(form);
  });
  app.addEventListener("change", (event: Event) => {
    const target = event.target; if (!(target instanceof HTMLSelectElement) || target.name !== "concept") return; const form = target.closest<HTMLFormElement>("#movement-form"); if (!form) return; const category = form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value ?? "Cuenta bancaria"; updateInvestmentFields(form, category, target.value); updatePurchaseAmount(form); updateMovementSubmitState(form);
  });
  app.addEventListener("change", (event: Event) => {
    const target = event.target; if (!(target instanceof HTMLInputElement) || target.name !== "type") return; const form = target.closest<HTMLFormElement>("#movement-form"); if (!form || form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value !== "Acciones") return;
    const direction = target.value as "Entrada" | "Salida"; updateInvestmentConceptOptions(form, direction); const concept = form.querySelector<HTMLSelectElement>('select[name="concept"]')?.value ?? ""; updateInvestmentFields(form, "Acciones", concept); updatePurchaseAmount(form); updateMovementSubmitState(form);
  });
  app.addEventListener("focusin", (event: Event) => { const target = event.target; if (!(target instanceof HTMLInputElement) || !target.matches("[data-currency-input]")) return; const numeric = parseNumericInput(target.value); target.value = Number.isFinite(numeric) ? String(numeric) : ""; });
  app.addEventListener("focusout", (event: Event) => { const target = event.target; if (!(target instanceof HTMLInputElement)) return; if (target.matches("[data-currency-input]")) { formatCurrencyInput(target); const form = target.closest<HTMLFormElement>("#movement-form"); if (form) updateMovementSubmitState(form); } });
  app.addEventListener("change", (event: Event) => { const target = event.target; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return; const form = target.closest<HTMLFormElement>("#movement-form"); if (form) updateMovementSubmitState(form); });
  app.addEventListener("submit", (event: SubmitEvent) => {
    const target = event.target; if (!(target instanceof HTMLFormElement) || target.id !== "movement-form") return; event.preventDefault(); if (target.dataset.submitting === "true") return;
    if (target.dataset.confirmedSave !== "true") {
      if (!target.reportValidity()) return; const dialog = app.querySelector<HTMLDialogElement>("#movement-action-dialog"); const confirmButton = dialog?.querySelector<HTMLButtonElement>("[data-movement-action-confirm]"); if (!dialog || !confirmButton) return;
      dialog.dataset.action = "save"; delete dialog.dataset.movementId; app.querySelector<HTMLElement>("#movement-action-title")!.textContent = "Confirmar registro"; app.querySelector<HTMLElement>("#movement-action-message")!.textContent = "¿Deseas guardar este movimiento?"; confirmButton.textContent = "Aceptar"; confirmButton.classList.remove("button--danger"); confirmButton.classList.add("button--primary"); confirmButton.disabled = false; if (!dialog.open) dialog.showModal(); return;
    }
    delete target.dataset.confirmedSave;
    const token = getSessionAccessToken(); const status = target.querySelector<HTMLElement>("#movement-form-status"); const submitButton = target.querySelector<HTMLButtonElement>('button[type="submit"]'); const formData = new FormData(target);
    const date = String(formData.get("date") ?? "").trim(); const category = String(formData.get("category") ?? "") as "Cuenta bancaria" | "Acciones"; const concept = String(formData.get("concept") ?? "").trim(); const bankAccount = target.querySelector<HTMLSelectElement>("#movement-account"); const assetAccount = target.querySelector<HTMLSelectElement>("#movement-asset"); const selectedAccount = category === "Acciones" ? assetAccount?.value.trim() ?? "" : bankAccount?.value.trim() ?? ""; const amount = parseNumericInput(String(formData.get("amount") ?? "")); const notes = String(formData.get("notes") ?? "").trim(); const quantityRaw = String(formData.get("quantity") ?? "").trim(); const averageCostRaw = String(formData.get("averageCost") ?? "").trim(); const quantity = quantityRaw ? Number(quantityRaw) : undefined; const averageCostParsed = averageCostRaw ? parseNumericInput(averageCostRaw) : Number.NaN; const averageCost = averageCostRaw && Number.isFinite(averageCostParsed) ? averageCostParsed : undefined; const isTrade = category === "Acciones" && ["Compra", "Venta"].includes(concept); const isBuy = category === "Acciones" && concept === "Compra"; const selectedType = String(formData.get("type") ?? "");
    const type = category === "Cuenta bancaria" ? (concept === "Depósito" ? "Entrada" : "Salida") : (selectedType === "Entrada" || selectedType === "Salida" ? selectedType : getInvestmentDirection(concept));
    if (!token || !date || !selectedAccount || !concept || !Number.isFinite(amount) || amount <= 0 || (isTrade && (quantity === undefined || !Number.isInteger(quantity) || quantity <= 0)) || (isBuy && (averageCost === undefined || !Number.isFinite(averageCost) || averageCost <= 0))) {
      if (status) { status.textContent = "Revisa la fecha, la cuenta o activo, el concepto y los importes requeridos."; status.className = "movement-form__status movement-field--full is-error"; } return;
    }
    target.dataset.submitting = "true"; if (submitButton) submitButton.disabled = true; if (status) { status.textContent = "Guardando en Google Sheets…"; status.className = "movement-form__status movement-field--full"; }
    void (async () => {
      try {
        const editId = target.dataset.editId; const savedMovement = { id: editId || crypto.randomUUID(), date, type: type as "Entrada" | "Salida", account: selectedAccount, category, amount, concept, notes, ...(isTrade && quantity !== undefined ? { quantity } : {}), ...(isBuy && averageCost !== undefined ? { averageCost } : {}), currency: "MXN" as const };
        if (editId) { await updateMovement(token, savedMovement); appState.movements = appState.movements.map((item) => item.id === editId ? savedMovement : item).sort((a, b) => b.date.localeCompare(a.date)); }
        else { await appendMovement(token, savedMovement); appState.movements = [savedMovement, ...appState.movements].sort((a, b) => b.date.localeCompare(a.date)); }
        try { appState.movements = await getMovements(token); } catch { /* append already confirmed; keep local record */ }
        renderPage(app); showMovementSuccess(app, editId ? "Movimiento actualizado correctamente." : "Movimiento guardado correctamente.");
      } catch (error) {
        target.dataset.submitting = "false"; updateMovementSubmitState(target); if (status) { status.textContent = error instanceof Error ? error.message : "No fue posible guardar el movimiento."; status.className = "movement-form__status movement-field--full is-error"; }
      }
    })();
  });
  initializePullToRefresh(app);
}

function showMovementSuccess(app: HTMLDivElement, message: string): void {
  const toast = app.querySelector<HTMLElement>("#movement-success-toast"); const messageElement = app.querySelector<HTMLElement>("#movement-success-message"); if (!toast || !messageElement) return; const previousTimer = Number(toast.dataset.hideTimer); if (previousTimer) window.clearTimeout(previousTimer); messageElement.textContent = message; toast.hidden = false; toast.dataset.hideTimer = String(window.setTimeout(() => { toast.hidden = true; delete toast.dataset.hideTimer; }, 5000));
}

function initializePullToRefresh(app: HTMLDivElement): void {
  app.addEventListener("touchstart", (event: TouchEvent) => {
    if (!appStateHasSession() || appState.isConnecting) return; const touch = event.touches[0]; if (!touch) return; const scrollContainer = document.querySelector<HTMLElement>("[data-scroll-container]"); const scrollTop = scrollContainer?.scrollTop ?? window.scrollY; if (scrollTop > 0) return; appState.touchStartY = touch.clientY; appState.pullDistance = 0; appState.pullTracking = true;
  }, { passive: true });
  app.addEventListener("touchmove", (event: TouchEvent) => {
    if (!appState.pullTracking || appState.touchStartY === null) return; const touch = event.touches[0]; if (!touch) return; const distance = touch.clientY - appState.touchStartY; if (distance <= 0) { appState.pullDistance = 0; return; } appState.pullDistance = Math.min(distance * 0.5, 120); const indicator = app.querySelector<HTMLElement>("[data-refresh-indicator]"); if (indicator) { indicator.style.transform = `translateY(${appState.pullDistance}px)`; indicator.style.opacity = String(Math.min(appState.pullDistance / PULL_THRESHOLD, 1)); } if (distance > 0 && event.cancelable) event.preventDefault();
  }, { passive: false });
  const finishPull = (): void => {
    const shouldRefresh = appState.pullTracking && appState.pullDistance >= PULL_THRESHOLD && appStateHasSession() && !appState.isConnecting; appState.touchStartY = null; appState.pullTracking = false; appState.pullDistance = 0;
    if (shouldRefresh) void connectGoogleSheets(app); else { const indicator = app.querySelector<HTMLElement>("[data-refresh-indicator]"); if (indicator) { indicator.style.transform = ""; indicator.style.opacity = ""; } }
  };
  app.addEventListener("touchend", finishPull, { passive: true }); app.addEventListener("touchcancel", finishPull, { passive: true });
}
