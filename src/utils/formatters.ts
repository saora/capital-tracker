
export function formatCurrency(
  value: number,
  currency: 'MXN' | 'USD' = 'MXN',
): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}%`;
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`));
}
