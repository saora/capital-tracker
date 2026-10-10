
export interface TransactionItemViewModel {
  symbol: string;
  label: string;
  date: string;
  amount: string;
}

export interface TransactionsViewModel {
  title: string;
  subtitle: string;
  itemsHtml: string;
  emptyMessage: string;
}
