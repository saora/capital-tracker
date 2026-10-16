import type { AssetType, Currency } from '../../types/investment';

export interface PortfolioPosition {
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  location: string;
  currentValue: number;
  investedValue: number;
  gainValue: number;
  gainPercent: number;
  valueLabel: string;
  quantityLabel: string;
  gainPercentLabel: string;
  gainAmountLabel: string;
  gainArrow: string;
  currentPriceLabel: string;
  dailyChangeLabel: string;
  dailyChangeClass:
    | 'text-positive'
    | 'text-negative'
    | 'text-muted';
  gainClass: 'text-positive' | 'text-negative';
}

export type PortfolioProvider = 'GBM' | 'BITSO' | 'BANCO';

export interface PortfolioViewModel {
  provider: PortfolioProvider;
  positions: PortfolioPosition[];
  totalPositions: number;
  totalValueLabel: string;
  totalGainAmountLabel: string;
  /** Aggregate gain based on provider entry capital, not per-position cost basis. */
  totalGainValue: number;
  totalPerformanceLabel: string;
  totalGainClass: 'text-positive' | 'text-negative';
  currency: Currency;
  disclaimer: string;
}
