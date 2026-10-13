import type { Movement, CatalogAsset } from '../../services/movements.service';
import { formatCurrency } from '../../utils/formatters';

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function localDateInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).format(parsed);
}

function accountOptions(catalog: CatalogAsset[], category: 'Cuenta bancaria' | 'Acciones'): string {
  const eligible = catalog.filter((asset) =>
    category === 'Cuenta bancaria'
      ? asset.type === 'Banco'
      : asset.type === 'Accion' || asset.type === 'ETF' || asset.type === 'Crypto',
  );
  return eligible
    .map((asset) => `<option value="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</option>`)
    .join('');
}

type MovementPeriod = '1D' | '1S' | '1M' | '1A';

const movementPeriodLabels: Record<MovementPeriod, string> = {
  '1D': '1D',
  '1S': '1S',
  '1M': '1M',
  '1A': '1A',
};

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function filterMovements(movements: Movement[], period: MovementPeriod): Movement[] {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (period === '1D') {
    // Only movements made today.
  } else if (period === '1S') {
    start.setDate(start.getDate() - 6);
  } else if (period === '1M') {
    start.setDate(start.getDate() - 29);
  } else {
    start.setDate(start.getDate() - 364);
  }
  const startDate = localDateValue(start);
  const endDate = localDateValue(end);
  return movements.filter((movement) => movement.date >= startDate && movement.date <= endDate);
}

function renderMovementPeriods(selected: MovementPeriod): string {
  return (Object.entries(movementPeriodLabels) as [MovementPeriod, string][])
    .map(([period, label]) => `
      <button type="button" class="chart-period${period === selected ? ' chart-period--active' : ''}"
        data-movement-period="${period}" aria-pressed="${period === selected}">${label}</button>
    `).join('');
}

function renderMovement(movement: Movement): string {
  const incoming = movement.type === 'Entrada';
  const signedAmount = `${incoming ? '+' : '−'}${formatCurrency(movement.amount, movement.currency)}`;
  const facts = [
    `<div><span>Fecha</span><strong>${escapeHtml(formatDate(movement.date))}</strong></div>`,
    `<div><span>Tipo</span><strong>${escapeHtml(movement.type)}</strong></div>`,
    `<div><span>Categoría</span><strong>${movement.category === 'Acciones' ? 'Acciones y ETF' : 'Cuenta bancaria'}</strong></div>`,
    `<div><span>Concepto</span><strong>${escapeHtml(movement.concept || '—')}</strong></div>`,
    `<div><span>Importe</span><strong class="movement-row__amount ${incoming ? 'is-incoming' : 'is-outgoing'}">${escapeHtml(signedAmount)}</strong></div>`,
    ...(movement.commission !== undefined ? [`<div><span>Comisión</span><strong>${escapeHtml(formatCurrency(movement.commission, movement.currency))}</strong></div>`] : []),
    ...(movement.commission !== undefined && ['Compra', 'Venta'].includes(movement.concept) ? [`<div><span>Total</span><strong>${escapeHtml(formatCurrency(movement.amount + movement.commission, movement.currency))}</strong></div>`] : []),
    ...(movement.quantity !== undefined ? [`<div><span>Número de títulos</span><strong>${escapeHtml(String(movement.quantity))}</strong></div>`] : []),
    ...(movement.averageCost !== undefined ? [`<div><span>Costo promedio</span><strong>${escapeHtml(formatCurrency(movement.averageCost, movement.currency))}</strong></div>`] : []),
    ...(movement.notes ? [`<div class="movement-row__note"><span>Notas</span><strong>${escapeHtml(movement.notes)}</strong></div>`] : []),
  ].join('');
  return `
    <article class="movement-row" data-movement-row="${escapeHtml(movement.id)}">
      <button type="button" class="movement-row__summary" data-movement-expand="${escapeHtml(movement.id)}" aria-expanded="false" aria-label="Ver detalle de ${escapeHtml(movement.account)}">
        <span class="movement-row__type ${incoming ? 'is-incoming' : 'is-outgoing'}" aria-hidden="true">${incoming ? '↙' : '↗'}</span>
        <span class="movement-row__summary-text"><strong>${escapeHtml(movement.account)} · ${escapeHtml(movement.concept || movement.type)}</strong><small>${escapeHtml(formatDate(movement.date))}</small></span>
        <strong class="movement-row__amount ${incoming ? 'is-incoming' : 'is-outgoing'}">${escapeHtml(signedAmount)}</strong><span class="movement-row__chevron" aria-hidden="true">›</span>
      </button>
      <section class="movement-row__expanded" data-movement-detail="${escapeHtml(movement.id)}" tabindex="-1" hidden>
        <div class="movement-row__facts">${facts}</div>
        <div class="movement-row__actions">
          <button type="button" class="movement-icon-button" data-movement-edit="${escapeHtml(movement.id)}" aria-label="Editar movimiento" title="Editar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
          <button type="button" class="movement-icon-button movement-icon-button--danger" data-movement-delete="${escapeHtml(movement.id)}" aria-label="Eliminar movimiento" title="Eliminar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg></button>
        </div>
      </section>
    </article>`;
}

export function renderTransactions(
  catalog: CatalogAsset[] = [],
  movements: Movement[] = [],
  selectedPeriod: MovementPeriod = '1M',
): string {
  const bankOptions = accountOptions(catalog, 'Cuenta bancaria');
  const assetOptions = accountOptions(catalog, 'Acciones');
  const filteredMovements = filterMovements(movements, selectedPeriod);
  const movementsHtml = filteredMovements.length
    ? filteredMovements.map(renderMovement).join('')
    : '<div class="movement-empty">No hay movimientos en este periodo.</div>';

  return `
    <section class="transactions-page">
      <header class="page-header">
        <div>
          <p class="dashboard__greeting">Registro financiero</p>
          <h1 class="page-title">Movimientos</h1>
          <p>Registra entradas y salidas con su fecha real, incluso si son anteriores.</p>
        </div>
      </header>

      <div class="movement-add-wrap">
        <button type="button" class="movement-add-button" data-movement-form-toggle aria-label="Agregar movimiento" title="Agregar movimiento">
          <span aria-hidden="true">+</span>
        </button>
      </div>

      <section class="card movement-form-card" id="movement-form-card" hidden>
        <header class="card__header">
          <h2 class="card__title" id="movement-form-title">Registrar movimiento</h2>
          <span class="movement-sheet-badge">Google Sheets</span>
        </header>
        <form id="movement-form" class="movement-form">
          <label class="movement-field movement-date-field" data-field-category="all">
            <span>Fecha del movimiento</span>
            <span class="movement-date-control">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M16 3v4M8 3v4M3.5 10h17"/></svg>
              <input name="date" type="date" required value="${localDateInputValue()}" aria-label="Fecha del movimiento" />
            </span>
          </label>

          <fieldset class="movement-field movement-field--full movement-category-field">
            <legend>¿Dónde ocurrió?</legend>
            <div class="movement-category-toggle" role="radiogroup" aria-label="Dónde ocurrió">
              <label class="movement-category-option">
                <input type="radio" name="category" value="Cuenta bancaria" checked />
                <span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 9h18M5 9v10m4-10v10m6-10v10m4-10v10M3 19h18M12 3 2.5 8h19L12 3Z" /></svg>Banco</span>
              </label>
              <label class="movement-category-option movement-category-option--stocks">
                <input type="radio" name="category" value="Acciones" />
                <span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 20V4M3 20h18M7 15v-4h3v4H7Zm7 0V6h3v9h-3Z" /><path d="m6 8 4-3 4 2 5-4" /></svg>Acciones</span>
              </label>
            </div>
          </fieldset>

          <label class="movement-field" data-field-category="Cuenta bancaria">
            <span>Cuenta bancaria</span>
            <select name="account" id="movement-account" required>
              <option value="">Selecciona una cuenta</option>
              ${bankOptions || '<option value="" disabled>No hay cuentas de tipo Banco en Catalogo</option>'}
            </select>
          </label>

          <label class="movement-field" data-field-category="Acciones" hidden>
            <span>Acción o activo</span>
            <select name="account" id="movement-asset" disabled>
              <option value="">Selecciona una acción o activo</option>
              ${assetOptions || '<option value="" disabled>No hay activos de tipo ETF, Accion o Crypto en Catalogo</option>'}
            </select>
          </label>

          <fieldset class="movement-field movement-field--full movement-direction-field" data-field-category="Acciones" hidden>
            <legend>Tipo de movimiento</legend>
            <div class="movement-direction-toggle" role="radiogroup" aria-label="Tipo de movimiento">
              <label class="movement-direction-option movement-direction-option--in">
                <input type="radio" name="type" value="Entrada" checked />
                <span>↙ Entrada</span>
              </label>
              <label class="movement-direction-option movement-direction-option--out">
                <input type="radio" name="type" value="Salida" />
                <span>↗ Salida</span>
              </label>
            </div>
          </fieldset>

          <label class="movement-field" data-field-category="all">
            <span>Concepto</span>
            <select name="concept" required>
              <option value="Depósito" data-movement-category="Cuenta bancaria">Depósito</option>
              <option value="Retiro" data-movement-category="Cuenta bancaria">Retiro</option>
              <option value="Compra" data-movement-category="Acciones" data-movement-direction="Entrada" hidden>Compra</option>
              <option value="Venta" data-movement-category="Acciones" data-movement-direction="Salida" hidden>Venta</option>
              <option value="Dividendo" data-movement-category="Acciones" data-movement-direction="Entrada" hidden>Dividendo</option>
              <option value="Comisión" data-movement-category="Acciones" data-movement-direction="Salida" hidden>Comisión</option>
              <option value="Otro" data-movement-category="Acciones" data-movement-direction="all" hidden>Otro</option>
            </select>
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra,Venta" hidden>
            <span>Número de títulos</span>
            <input name="quantity" type="number" min="1" step="1" inputmode="numeric" placeholder="0" disabled />
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra" hidden>
            <span>Costo promedio</span>
            <input name="averageCost" type="text" inputmode="decimal" autocomplete="off" placeholder="$0.00" data-currency-input min="0.01" required disabled />
          </label>

          <label class="movement-field" data-field-category="all">
            <span>Importe</span>
            <input name="amount" type="text" inputmode="decimal" autocomplete="off" placeholder="$0.00" data-currency-input required />
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra,Venta" hidden>
            <span>Comisión</span>
            <input name="commission" type="text" inputmode="decimal" autocomplete="off" placeholder="$0.00" data-currency-input disabled />
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra,Venta" hidden>
            <span>Total (importe + comisión)</span>
            <input name="total" type="text" placeholder="$0.00" readonly aria-readonly="true" data-trade-total disabled />
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra,Venta" hidden>
            <span>Tipo de moneda</span>
            <select name="currency" disabled>
              <option value="MXN">MXN — Peso mexicano</option>
              <option value="USD">USD — Dólar estadounidense</option>
            </select>
          </label>

          <label class="movement-field movement-field--full" data-field-category="all">
            <span>Notas (opcional)</span>
            <span class="movement-notes-control">
              <textarea name="notes" rows="2" maxlength="30" placeholder="Detalles, referencia o motivo del movimiento"></textarea>
              <span class="movement-notes-counter" data-notes-counter aria-live="polite">00/30</span>
            </span>
          </label>

          <p class="movement-form__hint movement-field--full">El registro se guarda en la pestaña Movimientos y no modifica automáticamente los saldos ni las posiciones.</p>
          <div class="movement-form__actions movement-field--full"><button class="button button--primary movement-submit" type="submit" disabled>Guardar movimiento</button><button class="button movement-cancel" type="button" data-movement-cancel hidden>Cancelar</button></div>
          <p id="movement-form-status" class="movement-form__status movement-field--full" role="status" aria-live="polite"></p>
        </form>
      </section>

      <dialog class="movement-confirm-dialog" id="movement-action-dialog" aria-labelledby="movement-action-title" aria-describedby="movement-action-message">
        <div class="movement-confirm-dialog__content">
          <h2 id="movement-action-title">Confirmar acción</h2>
          <p id="movement-action-message">¿Deseas continuar?</p>
          <div class="movement-confirm-dialog__actions">
            <button type="button" class="button" data-movement-action-cancel>Cancelar</button>
            <button type="button" class="button button--primary" data-movement-action-confirm>Aceptar</button>
          </div>
        </div>
      </dialog>

      <div class="movement-success-toast" id="movement-success-toast" role="status" aria-live="polite" hidden>
        <svg class="movement-success-toast__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-7"/></svg>
        <span class="movement-success-toast__message" id="movement-success-message"></span>
        <button type="button" class="movement-success-toast__close" data-movement-success-close aria-label="Cerrar mensaje de confirmación" title="Cerrar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </div>

      <section class="dashboard__section" id="movement-history-section">
        <div class="section-heading">
          <h2>Historial</h2>
          <span class="section-count">${filteredMovements.length}</span>
        </div>
        <div class="chart-periods movement-periods" role="group" aria-label="Filtrar historial de movimientos">
          ${renderMovementPeriods(selectedPeriod)}
        </div>
        <div class="card movement-history">
          ${movementsHtml}
        </div>
      </section>
    </section>
  `;
}
