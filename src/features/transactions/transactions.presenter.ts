
import { demoTransactions } from '../../services/investment-service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { TransactionType } from '../../types/transaction';
import type {
  TransactionItemViewModel,
  TransactionsViewModel,
} from './transactions.types';

const labels: Record<TransactionType, string> = {
  buy: 'Compra',
  sell: 'Venta',
  dividend: 'Dividendo',
  deposit: 'Depósito',
  withdrawal: 'Retiro',
  fee: 'Comisión',
};

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function presentTransaction(
  transaction: (typeof demoTransactions)[number],
): TransactionItemViewModel {
  const amount = transaction.quantity * transaction.price;

  return {
    symbol: escapeHtml(transaction.symbol),
    label: labels[transaction.type],
    date: formatDate(transaction.date),
    amount: formatCurrency(amount, transaction.currency),
  };
}

function renderTransactionItem(
  item: TransactionItemViewModel,
): string {
  return `
    <article class="transaction-item">
      <div class="transaction-info">
        <strong>${item.symbol} · ${item.label}</strong>
        <span>${item.date}</span>
      </div>

      <div class="transaction-amount">
        ${item.amount}
      </div>
    </article>
  `;
}

export function presentTransactions(): TransactionsViewModel {
  const items = demoTransactions.map(presentTransaction);

  return {
    title: 'Transacciones',
    subtitle: 'Movimientos recientes de tu portafolio',
    itemsHtml: items.length > 0
      ? items.map(renderTransactionItem).join('')
      : '<p class="transactions-empty">No hay transacciones registradas.</p>',
    emptyMessage: 'No hay transacciones registradas.',
  };
}
