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
  gainLabel: string;
  gainClass: 'text-positive' | 'text-negative';
}

export interface PortfolioViewModel {
  positions: PortfolioPosition[];
  totalPositions: number;
  totalValueLabel: string;
  totalGainAmountLabel: string;
  totalPerformanceLabel: string;
  totalGainClass: 'text-positive' | 'text-negative';
  currency: Currency;
  disclaimer: string;
}
