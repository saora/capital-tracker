
import type {
  PerformanceChartData,
  PerformanceChartViewModel,
} from './performance-chart.types';

import {
  calculatePerformance,
} from '../../utils/dashboard-calculations';

import {
  formatCurrency,
  formatPercent,
} from '../../../../utils/formatters';

import type {
  ChartPoint,
  PerformancePeriod,
} from '../../../../types/portfolio';

import './performance-chart.css';

const periodLabels: Record<PerformancePeriod, string> = {
  '1W': '1S',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1A',
  ALL: 'Todo',
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const PADDING_X = 8;
const PADDING_Y = 18;

interface ChartCoordinate {
  x: number;
  y: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPeriods(
  selectedPeriod: PerformancePeriod,
): string {
  return (
    Object.entries(periodLabels) as [
      PerformancePeriod,
      string,
    ][]
  )
    .map(([period, label]) => {
      const isActive = period === selectedPeriod;

      return `
        <button
          type="button"
          class="chart-period${isActive ? ' chart-period--active' : ''}"
          data-period="${period}"
          aria-pressed="${isActive}"
        >${label}</button>
      `;
    })
    .join('');
}

function createCoordinates(
  points: ChartPoint[],
): ChartCoordinate[] {
  if (points.length === 0) {
    return [];
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  let lowerBound = minValue;
  let upperBound = maxValue;

  // Give flat datasets a visible, centered position.
  if (minValue === maxValue) {
    const padding = Math.max(Math.abs(minValue) * 0.01, 1);

    lowerBound = minValue - padding;
    upperBound = maxValue + padding;
  }

  const valueRange = upperBound - lowerBound;
  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const plotHeight = CHART_HEIGHT - PADDING_Y * 2;

  return points.map((point, index) => {
    const x =
      points.length === 1
        ? CHART_WIDTH / 2
        : PADDING_X +
          (index / (points.length - 1)) * plotWidth;

    const y =
      PADDING_Y +
      ((upperBound - point.value) / valueRange) * plotHeight;

    return { x, y };
  });
}

function createSmoothPath(
  coordinates: ChartCoordinate[],
): string {
  if (coordinates.length === 0) {
    return '';
  }

  if (coordinates.length === 1) {
    const point = coordinates[0];

    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  const commands = [
    `M ${coordinates[0].x.toFixed(2)} ${coordinates[0].y.toFixed(2)}`,
  ];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const previous = coordinates[Math.max(0, index - 1)];
    const current = coordinates[index];
    const next = coordinates[index + 1];
    const following =
      coordinates[Math.min(coordinates.length - 1, index + 2)];

    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;

    const control2X = next.x - (following.x - current.x) / 6;
    const control2Y = next.y - (following.y - current.y) / 6;

    commands.push(
      `C ${control1X.toFixed(2)} ${control1Y.toFixed(2)}, ` +
      `${control2X.toFixed(2)} ${control2Y.toFixed(2)}, ` +
      `${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }

  return commands.join(' ');
}

function renderInteractivePoints(
  points: ChartPoint[],
  coordinates: ChartCoordinate[],
): string {
  return points
    .map((point, index) => {
      const coordinate = coordinates[index];
      const label = point.date ?? point.label;
      const valueLabel = formatCurrency(point.value, 'MXN');
      const accessibleLabel =
        `${label}: ${valueLabel}. Selecciona para consultar este valor.`;

      const left = (coordinate.x / CHART_WIDTH) * 100;
      const top = (coordinate.y / CHART_HEIGHT) * 100;

      return `
        <button
          type="button"
          class="performance-chart__point"
          style="left: ${left}%; top: ${top}%"
          aria-label="${escapeHtml(accessibleLabel)}"
          title="${escapeHtml(`${label}: ${valueLabel}`)}"
        >
          <span
            class="performance-chart__tooltip"
            aria-hidden="true"
          >
            <span class="performance-chart__tooltip-date">
              ${escapeHtml(label)}
            </span>
            <span class="performance-chart__tooltip-value">
              ${escapeHtml(valueLabel)}
            </span>
          </span>
        </button>
      `;
    })
    .join('');
}

function renderChartSvg(
  points: ChartPoint[],
): string {
  if (points.length === 0) {
    return `
      <div class="chart-empty" role="status">
        No hay datos disponibles para este periodo.
      </div>
    `;
  }

  const coordinates = createCoordinates(points);
  const linePath = createSmoothPath(coordinates);
  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  const chartBottom = CHART_HEIGHT - PADDING_Y;

  const areaPath = [
    linePath,
    `L ${lastPoint.x.toFixed(2)} ${chartBottom}`,
    `L ${firstPoint.x.toFixed(2)} ${chartBottom}`,
    'Z',
  ].join(' ');

  const gridLines = [0, 1, 2, 3]
    .map((line) => {
      const y =
        PADDING_Y +
        (line / 3) * (CHART_HEIGHT - PADDING_Y * 2);

      return `
        <line
          x1="0"
          y1="${y.toFixed(2)}"
          x2="${CHART_WIDTH}"
          y2="${y.toFixed(2)}"
          class="performance-chart__grid-line"
        />
      `;
    })
    .join('');

  const endPoint = points[points.length - 1];
  const endCoordinate = coordinates[coordinates.length - 1];

  return `
    <div class="performance-chart__plot">
      <svg
        class="performance-chart__svg"
        viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolución del portafolio. Último valor: ${escapeHtml(
          formatCurrency(endPoint.value, 'MXN'),
        )}."
      >
        <defs>
          <linearGradient
            id="performance-area-gradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stop-color="var(--color-brand-500, #176447)"
              stop-opacity="0.24"
            />
            <stop
              offset="100%"
              stop-color="var(--color-brand-500, #176447)"
              stop-opacity="0.015"
            />
          </linearGradient>
        </defs>

        ${gridLines}

        <path
          d="${areaPath}"
          fill="url(#performance-area-gradient)"
        />

        <path
          d="${linePath}"
          class="performance-chart__line"
        />

        <circle
          cx="${endCoordinate.x.toFixed(2)}"
          cy="${endCoordinate.y.toFixed(2)}"
          r="4"
          class="performance-chart__last-point"
        />
      </svg>

      <div
        class="performance-chart__interaction"
        role="group"
        aria-label="Consultar valores de la gráfica"
      >
        ${renderInteractivePoints(points, coordinates)}
      </div>
    </div>
  `;
}

export function presentPerformanceChart({
  points,
  period,
}: PerformanceChartData): PerformanceChartViewModel {
  const metrics = calculatePerformance(points);

  return {
    title: 'Rendimiento',
    subtitle: 'Evolución de tu portafolio',
    changeLabel: formatPercent(metrics.changePercent),
    indicatorClass:
      metrics.change >= 0 ? 'text-positive' : 'text-negative',
    firstValueLabel: formatCurrency(
      points[0]?.value ?? 0,
      'MXN',
    ),
    lastValueLabel: formatCurrency(
      points[points.length - 1]?.value ?? 0,
      'MXN',
    ),
    chartHtml: renderChartSvg(points),
    periodsHtml: renderPeriods(period),
    empty: points.length === 0,
  };
}
