
export type AppRoute =
  | 'dashboard'
  | 'portfolio'
  | 'transactions'
  | 'watchlist';

const navigationItems: {
  route: AppRoute;
  label: string;
  icon: string;
}[] = [
  {
    route: 'dashboard',
    label: 'Inicio',
    icon: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  },
  {
    route: 'portfolio',
    label: 'Portafolio',
    icon: '<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 6-7"/>',
  },
  {
    route: 'transactions',
    label: 'Movimientos',
    icon: '<path d="M7 7h14"/><path d="m17 3 4 4-4 4"/><path d="M17 17H3"/><path d="m7 13-4 4 4 4"/>',
  },
  {
    route: 'watchlist',
    label: 'Watchlist',
    icon: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  },
];

export function renderBottomNav(activeRoute: AppRoute): string {
  return `
    <nav class="bottom-nav" aria-label="Navegación principal">
      ${navigationItems
        .map(
          (item) => `
            <button
              class="bottom-nav__item ${
                item.route === activeRoute ? 'is-active' : ''
              }"
              data-route="${item.route}"
              aria-current="${
                item.route === activeRoute ? 'page' : 'false'
              }"
              type="button"
            >
              <svg viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true">
                ${item.icon}
              </svg>
              <span>${item.label}</span>
            </button>
          `,
        )
        .join('')}
    </nav>
  `;
}
