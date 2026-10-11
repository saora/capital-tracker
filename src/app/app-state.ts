
import type { AppRoute } from '../types/navigation';
import type { PerformancePeriod } from '../types/portfolio';
import type { InvestmentSheetsData } from '../services/google-sheets.service';

export type HoldingsCategory = 'stocks' | 'bank-accounts';

export interface AppState {
  activeRoute: AppRoute;
  activePeriod: PerformancePeriod;
  activeHoldingsCategory: HoldingsCategory;
  investmentData: InvestmentSheetsData | null;
  isConnecting: boolean;
  isAuthLoading: boolean;
  connectionError: string;
  touchStartY: number | null;
  pullDistance: number;
  pullTracking: boolean;
}

export const appState: AppState = {
  activeRoute: 'dashboard',
  activePeriod: '1M',
  activeHoldingsCategory: 'stocks',
  investmentData: null,
  isConnecting: false,
  isAuthLoading: false,
  connectionError: '',
  touchStartY: null,
  pullDistance: 0,
  pullTracking: false,
};

export const PULL_THRESHOLD = 75;

export const validPeriods: PerformancePeriod[] = [
  '1W',
  '1M',
  '3M',
  '1Y',
  'ALL',
];

export const validRoutes: AppRoute[] = [
  'dashboard',
  'portfolio',
  'transactions',
  'watchlist',
];

export const validHoldingsCategories: HoldingsCategory[] = [
  'stocks',
  'bank-accounts',
];
