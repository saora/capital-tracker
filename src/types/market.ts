
import type { Currency } from './investment';

export interface MarketQuote {
  symbol: string;
  price: number;
  currency: Currency;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  currency: Currency;
  lastPrice: number;
  changePercent: number;
  addedAt: string;
}
