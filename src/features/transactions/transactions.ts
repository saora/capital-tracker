
import { presentTransactions } from './transactions.presenter';
import { renderTransactionsTemplate } from './transactions.template';

export function renderTransactions(): string {
  const viewModel = presentTransactions();

  return renderTransactionsTemplate(viewModel);
}
