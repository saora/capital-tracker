import type { AppRoute } from '../types/navigation';
import type { PerformancePeriod } from '../types/portfolio';
import type { InvestmentSheetsData } from '../services/google-sheets.service';
import type { Movement, CatalogAsset } from '../services/movements.service';

export type MovementPeriod = '1D' | '1S' | '1M' | '1A';

export interface AppState {
  activeRoute: AppRoute;
  activePeriod: PerformancePeriod;
  investmentData: InvestmentSheetsData | null;
  movements: Movement[];
  catalog: CatalogAsset[];
  movementPeriod: MovementPeriod;
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
  investmentData: null,
  movements: [],
  catalog: [],
  movementPeriod: '1M',
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
  'session',
];

