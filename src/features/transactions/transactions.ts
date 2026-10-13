import type { Investment } from '../../types/investment';
import type { Movement } from '../../services/movements.service';
import { formatCurrency } from '../../utils/formatters';

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).format(parsed);
}

function accountOptions(investments: Investment[], category: 'Cuenta bancaria' | 'Acciones'): string {
  const eligible = investments.filter((investment) =>
    category === 'Cuenta bancaria'
      ? investment.assetType === 'fixed-income' || investment.assetType === 'bank-account'
      : investment.assetType === 'stock' || investment.assetType === 'etf' || investment.assetType === 'crypto',
  );
  const unique = new Map<string, string>();
  eligible.forEach((investment) => {
    const value = category === 'Cuenta bancaria'
      ? investment.name
      : investment.symbol;
    if (value) unique.set(value, value);
  });
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, 'es-MX'))
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join('');
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
          ${movement.notes ? `<small>${escapeHtml(movement.notes)}</small>` : ''}
        </div>
      </div>
      <strong class="movement-row__amount ${incoming ? 'is-incoming' : 'is-outgoing'}">${escapeHtml(signedAmount)}</strong>
    </article>
  `;
}

export function renderTransactions(
  investments: Investment[] = [],
  movements: Movement[] = [],
): string {
  const bankOptions = accountOptions(investments, 'Cuenta bancaria');
  const assetOptions = accountOptions(investments, 'Acciones');
  const movementsHtml = movements.length
    ? movements.map(renderMovement).join('')
    : '<div class="movement-empty">Todavía no hay movimientos registrados. Usa el formulario para agregar el primero.</div>';

  return `
    <section class="transactions-page">
      <header class="page-header">
        <div>
          <p class="dashboard__greeting">Registro financiero</p>
          <h1 class="page-title">Movimientos</h1>
          <p>Registra entradas y salidas con su fecha real, incluso si son anteriores.</p>
        </div>
      </header>

      <section class="card movement-form-card">
        <header class="card__header">
          <h2 class="card__title">Registrar movimiento</h2>
          <span class="movement-sheet-badge">Google Sheets</span>
        </header>
        <form id="movement-form" class="movement-form">
          <label class="movement-field">
            <span>Fecha del movimiento</span>
            <input name="date" type="date" required value="${new Date().toLocaleDateString('en-CA')}" />
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

          <label class="movement-field">
            <span>Tipo de movimiento</span>
            <select name="type" required>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
          </label>

          <label class="movement-field">
            <span id="movement-account-label">Cuenta bancaria</span>
            <select name="account" id="movement-account" required>
              <option value="">Selecciona una opción</option>
              <optgroup label="Cuentas bancarias" data-account-category="Cuenta bancaria">${bankOptions || '<option value="" disabled>No hay cuentas registradas</option>'}</optgroup>
              <optgroup label="Acciones y ETF" data-account-category="Acciones" hidden>${assetOptions || '<option value="" disabled>No hay activos registrados</option>'}</optgroup>
            </select>
          </label>

          <label class="movement-field">
            <span>Concepto</span>
            <select name="concept" required>
              <option value="Depósito" data-movement-category="Cuenta bancaria">Depósito</option>
              <option value="Retiro" data-movement-category="Cuenta bancaria">Retiro</option>
              <option value="Compra" data-movement-category="Acciones" hidden>Compra</option>
              <option value="Venta" data-movement-category="Acciones" hidden>Venta</option>
              <option value="Dividendo" data-movement-category="Acciones" hidden>Dividendo</option>
              <option value="Comisión" data-movement-category="Acciones" hidden>Comisión</option>
              <option value="Otro" data-movement-category="Cuenta bancaria">Otro</option>
              <option value="Otro" data-movement-category="Acciones" hidden>Otro</option>
            </select>
          </label>

          <label class="movement-field">
            <span>Importe (MXN)</span>
            <input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" required />
          </label>

          <label class="movement-field movement-field--full">
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
          <span class="section-count">${movements.length}</span>
        </div>
        <div class="card movement-history">
          ${movementsHtml}
        </div>
      </section>
    </section>
  `;
}
