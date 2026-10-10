
import type { TransactionsViewModel } from './transactions.types';

export function renderTransactionsTemplate(
  viewModel: TransactionsViewModel,
): string {
  const itemsHtml = viewModel.itemsHtml;

  return `
    <section class="transactions-page">
      <header class="page-header">
        <h1>${viewModel.title}</h1>
        <p>${viewModel.subtitle}</p>
      </header>

      <div class="transactions-list">
        ${itemsHtml}
      </div>
    </section>
  `;
}
