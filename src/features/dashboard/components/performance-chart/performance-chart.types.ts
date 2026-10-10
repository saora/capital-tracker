
import type {
  ChartPoint,
  PerformancePeriod,
} from '../../../../types/portfolio';

export interface PerformanceChartData {
  points: ChartPoint[];
  period: PerformancePeriod;
}

export interface PerformanceChartViewModel {
  title: string;
  subtitle: string;
  changeLabel: string;
  indicatorClass: string;
  firstValueLabel: string;
  lastValueLabel: string;
  chartHtml: string;
  periodsHtml: string;
  empty: boolean;
}
