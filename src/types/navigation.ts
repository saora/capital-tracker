
export type AppRoute =
  | 'dashboard'
  | 'portfolio'
  | 'transactions'
  | 'watchlist';

export interface NavigationItem {
  route: AppRoute;
  label: string;
  icon: string;
}
