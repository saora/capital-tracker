import type { Movement, CatalogAsset } from '../../services/movements.service';
import {
  accountOptions,
  renderMovement,
  renderTransactionsTemplate,
  type MovementPeriod,
} from './transactions.template';

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function filterMovements(movements: Movement[], period: MovementPeriod): Movement[] {
  if (period === 'Todo') return movements;

  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (period === '1S') {
    start.setDate(start.getDate() - 6);
  } else if (period === '1M') {
    start.setDate(start.getDate() - 29);
  } else if (period === '3M') {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(start.getDate() - 364);
  }
  const startDate = localDateValue(start);
  const endDate = localDateValue(end);
  return movements.filter((movement) => movement.date >= startDate && movement.date <= endDate);
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

  return renderTransactionsTemplate(
    bankOptions,
    assetOptions,
    movementsHtml,
    filteredMovements.length,
    selectedPeriod,
  );
}
