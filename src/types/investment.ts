export type AssetType =
  | 'stock'
  | 'etf'
  | 'crypto'
  | 'fixed-income'
  | 'bank-account';

export type Currency = 'MXN' | 'USD';

export interface Investment {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: Currency;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  dailyChangePercent?: number | null;
}

export interface InvestmentPosition extends Investment {
  marketValue: number;
  investedValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
}