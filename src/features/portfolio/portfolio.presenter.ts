
import type { Investment } from '../../types/investment';
import { formatCurrency } from '../../utils/formatters';
import type {
  PortfolioPosition,
  PortfolioViewModel,
} from './portfolio.types';

export function presentPortfolio(
  investments: Investment[],
  connected: boolean,
): PortfolioViewModel {
  const positions: PortfolioPosition[] = investments
    .filter(
      (item) =>
        item.assetType === 'stock' ||
        item.assetType === 'etf' ||
      item.assetType === 'crypto'
    )
    .map((item) => {
      const value = item.quantity * item.currentPrice;
      const cost = item.quantity * item.averageCost;
      const gain = value - cost;
      const gainPercent = cost
        ? (gain / cost) * 100
        : 0;

      return {
        symbol: item.symbol,
        name: item.name,
        assetType: item.assetType,
        currency: item.currency,
        valueLabel: formatCurrency(value, item.currency),
        gainPercentLabel: `${
          gain >= 0 ? '+' : ''
        }${gainPercent.toFixed(2)}%`,
        gainClass:
          gain >= 0 ? 'text-positive' : 'text-negative',
      };
    });

  return {
    positions,
    totalPositions: positions.length,
    disclaimer: connected
      ? 'Posiciones obtenidas de Google Sheets. Los valores reflejan la última información guardada en la hoja.'
      : 'Datos ficticios. Los valores están en la moneda indicada por activo.',
  };
}
