export type SkeletonPage = 'dashboard' | 'portfolio';

export function renderSkeletonLoader(
  page: SkeletonPage,
): string {
  if (page === 'portfolio') {
    return renderPortfolioSkeleton();
  }

  return renderDashboardSkeleton();
}

function renderDashboardSkeleton(): string {
  // Aquí va el HTML del skeleton del dashboard.
  return '';
}

function renderPortfolioSkeleton(): string {
  // Aquí va el HTML del skeleton del portafolio.
  return '';
}