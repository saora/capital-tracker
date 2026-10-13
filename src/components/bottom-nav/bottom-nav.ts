
export type AppRoute =
  | 'dashboard'
  | 'portfolio'
  | 'transactions'
  | 'watchlist'
  | 'session';

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
    route: 'session',
    label: 'Cuenta',
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
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
