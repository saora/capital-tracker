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
  const categoryLabel = movement.category === 'Acciones' ? 'Inversión' : 'Cuenta bancaria';
  const signedAmount = `${incoming ? '+' : '−'}${formatCurrency(movement.amount, movement.currency)}`;
  return `
    <article class="movement-row">
      <div class="movement-row__main">
        <span class="movement-row__type ${incoming ? 'is-incoming' : 'is-outgoing'}">${incoming ? '↙' : '↗'}</span>
        <div class="movement-row__details">
          <strong>${escapeHtml(movement.account)} · ${escapeHtml(movement.concept || movement.type)}</strong>
          <span>${escapeHtml(formatDate(movement.date))} · ${escapeHtml(categoryLabel)} · ${escapeHtml(movement.type)}</span>
          ${movement.quantity !== undefined ? `<small>Títulos: ${escapeHtml(String(movement.quantity))}</small>` : ''}
          ${movement.averageCost !== undefined ? `<small>Costo promedio: ${escapeHtml(formatCurrency(movement.averageCost, movement.currency))} por título</small>` : ''}
          ${movement.notes ? `<small>${escapeHtml(movement.notes)}</small>` : ''}
        </div>
      </div>
      <strong class="movement-row__amount ${incoming ? 'is-incoming' : 'is-outgoing'}">${escapeHtml(signedAmount)}</strong>
    </article>
  `;
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
          <h2 class="card__title">Registrar movimiento</h2>
          <span class="movement-sheet-badge">Google Sheets</span>
        </header>
        <form id="movement-form" class="movement-form">
          <label class="movement-field movement-field--full" data-field-category="all">
            <span>Fecha del movimiento</span>
            <input name="date" type="date" required value="${localDateInputValue()}" />
          </label>

          <fieldset class="movement-field movement-field--full">
            <legend>¿Dónde ocurrió?</legend>
            <div class="movement-choice-grid">
              <label class="movement-choice">
                <input type="radio" name="category" value="Cuenta bancaria" checked />
                <span><strong>Cuentas bancarias</strong><small>Depósitos y retiros</small></span>
              </label>
              <label class="movement-choice">
                <input type="radio" name="category" value="Acciones" />
                <span><strong>Acciones y ETF</strong><small>Compras, ventas y dividendos</small></span>
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

          <label class="movement-field" data-field-category="all">
            <span>Concepto</span>
            <select name="concept" required>
              <option value="Depósito" data-movement-category="Cuenta bancaria">Depósito</option>
              <option value="Retiro" data-movement-category="Cuenta bancaria">Retiro</option>
              <option value="Compra" data-movement-category="Acciones" hidden>Compra</option>
              <option value="Venta" data-movement-category="Acciones" hidden>Venta</option>
              <option value="Dividendo" data-movement-category="Acciones" hidden>Dividendo</option>
              <option value="Comisión" data-movement-category="Acciones" hidden>Comisión</option>
              <option value="Otro" data-movement-category="Acciones" hidden>Otro</option>
            </select>
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra,Venta" hidden>
            <span>Número de títulos</span>
            <input name="quantity" type="number" min="0.000001" step="any" inputmode="decimal" placeholder="0" disabled />
          </label>

          <label class="movement-field" data-field-category="Acciones" data-field-concept="Compra" hidden>
            <span>Costo promedio</span>
            <input name="averageCost" type="number" min="0.000001" step="any" inputmode="decimal" placeholder="0.00" disabled />
          </label>

          <label class="movement-field" data-field-category="all">
            <span>Importe (MXN)</span>
            <input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" required />
          </label>

          <label class="movement-field movement-field--full" data-field-category="all">
            <span>Notas (opcional)</span>
            <textarea name="notes" rows="2" maxlength="500" placeholder="Detalles, referencia o motivo del movimiento"></textarea>
          </label>

          <p class="movement-form__hint movement-field--full">El registro se guarda en la pestaña Movimientos y no modifica automáticamente los saldos ni las posiciones.</p>
          <button class="button button--primary movement-submit movement-field--full" type="submit">Guardar movimiento</button>
          <p id="movement-form-status" class="movement-form__status movement-field--full" role="status" aria-live="polite"></p>
        </form>
      </section>

      <section class="dashboard__section">
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
