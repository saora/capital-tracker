
import type { AssetType, Currency } from '../../types/investment';

export interface PortfolioPosition {
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  valueLabel: string;
  gainPercentLabel: string;
  gainClass: 'text-positive' | 'text-negative';
}

export interface PortfolioViewModel {
  positions: PortfolioPosition[];
  totalPositions: number;
  disclaimer: string;
}
