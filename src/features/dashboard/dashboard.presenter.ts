import type {
  DashboardData,
  DashboardViewModel,
} from './dashboard.types';

import { presentBalanceCard } from './components/balance-card/balance-card.presenter';
import { presentMetricsGrid } from './components/metrics-grid/metrics-grid.presenter';
import { presentPerformanceChart } from './components/performance-chart/performance-chart.presenter';

import { renderBalanceCardTemplate } from './components/balance-card/balance-card.template';
import { renderMetricsGridTemplate } from './components/metrics-grid/metrics-grid.template';
import { renderPerformanceChartTemplate } from './components/performance-chart/performance-chart.template';

export function presentDashboard(
  data: DashboardData,
): DashboardViewModel {
  const performanceChartViewModel = presentPerformanceChart({
    points: data.chartPoints,
    period: data.period,
  });

  const disclaimer =
    data.source === 'google-sheets'
      ? 'Saldos y posiciones cargados desde Google Sheets. La gráfica de rendimiento es ilustrativa y no representa un historial real.'
      : 'Datos de demostración. Los saldos, las posiciones y la gráfica no representan necesariamente tu portafolio real.';

  return {
    greeting: 'Resumen de tu patrimonio',

    balanceCardHtml: renderBalanceCardTemplate(
      presentBalanceCard({
        summary: data.summary,
      }),
    ),

    metricsGridHtml: renderMetricsGridTemplate(
      presentMetricsGrid({
        summary: data.summary,
      }),
    ),

    performanceChartHtml: renderPerformanceChartTemplate(
      performanceChartViewModel,
    ),

    // Las cuentas bancarias y los activos de renta fija ahora se consultan en Portafolio.
    holdingsListHtml: '',

    disclaimer,
  };
}