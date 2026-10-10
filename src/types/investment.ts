
export type AssetType =
  | 'stock'
  | 'etf'
  | 'crypto'
  | 'fixed-income';

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
}

export interface InvestmentPosition extends Investment {
  marketValue: number;
  investedValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
}
