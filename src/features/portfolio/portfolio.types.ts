import type { AssetType, Currency } from '../../types/investment';

export interface PortfolioPosition {
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  location: string;
  valueLabel: string;
  currentPriceLabel: string;
  dailyChangeLabel: string;
  dailyChangeClass:
    | 'text-positive'
    | 'text-negative'
    | 'text-muted';
  gainLabel: string;
  gainClass: 'text-positive' | 'text-negative';
}

export interface PortfolioViewModel {
  positions: PortfolioPosition[];
  totalPositions: number;
  disclaimer: string;
}