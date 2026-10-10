
const watchlist = [
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 520, change: 1.35 },
  { symbol: 'META', name: 'Meta Platforms', price: 710, change: 0.82 },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 245, change: -0.45 },
];

export function renderWatchlist(): string {
  const rows = watchlist.map((item) => `
    <article class="holding-row">
      <div class="holding-row__identity">
        <div class="asset-avatar">${item.symbol.slice(0, 1)}</div>
        <div class="holding-row__name">
          <strong>${item.symbol}</strong>
          <span>${item.name}</span>
        </div>
      </div>
      <div class="holding-row__numbers">
        <strong>${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(item.price)}</strong>
        <span class="${item.change >= 0 ? 'text-positive' : 'text-negative'}">
          ${item.change > 0 ? '+' : ''}${item.change.toFixed(2)}%
        </span>
      </div>
    </article>
  `).join('');

  return `
    <section class="dashboard">
      <header class="page-header">
        <div>
          <p class="dashboard__greeting">Activos que quieres seguir</p>
          <h1 class="page-title">Watchlist</h1>
        </div>
      </header>
      <section class="dashboard__section">
        <h2 class="dashboard__section-title">Mercado · ejemplo</h2>
        <div class="card holdings-list">${rows}</div>
      </section>
      <p class="demo-disclaimer">Precios ficticios; no son cotizaciones en tiempo real.</p>
    </section>
  `;
}
