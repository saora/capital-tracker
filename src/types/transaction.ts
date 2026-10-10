
import type { Currency } from './investment';

export type TransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'fee';

export interface Transaction {
  id: string;
  symbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  currency: Currency;
  date: string;
  fees?: number;
  notes?: string;
}
