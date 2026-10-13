
export type AppRoute =
  | 'dashboard'
  | 'portfolio'
  | 'transactions'
  | 'watchlist'
  | 'session';

export interface NavigationItem {
  route: AppRoute;
  label: string;
  icon: string;
}
