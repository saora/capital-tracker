
import type { Currency } from '../types/investment';

/**
 * Tasas de demostración expresadas en MXN por unidad de moneda.
 * No utilizar como tipo de cambio real de mercado.
 */
export const DEMO_EXCHANGE_RATES: Record<Currency, number> = {
  MXN: 1,
  USD: 18.5,
};

export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
): number {
  if (from === to) {
    return amount;
  }

  return (
    (amount * DEMO_EXCHANGE_RATES[from]) /
    DEMO_EXCHANGE_RATES[to]
  );
}
