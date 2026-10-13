export function renderSessionView(): string {
  return `
    <section class="session-page">
      <header class="page-header">
        <div>
          <p class="dashboard__greeting">Capital Tracker</p>
          <h1 class="page-title">Sesión</h1>
          <p>Administra la sesión de tu cuenta.</p>
        </div>
      </header>

      <section class="card session-page__card" aria-labelledby="session-page-title">
        <div class="session-page__identity">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <div>
            <h2 id="session-page-title">Sesión iniciada</h2>
            <p>Tu cuenta está conectada a Capital Tracker.</p>
          </div>
        </div>
        <button type="button" class="button session-page__logout" data-auth-action="logout">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
          </svg>
          <span>Cerrar sesión</span>
        </button>
      </section>
    </section>
  `;
}
