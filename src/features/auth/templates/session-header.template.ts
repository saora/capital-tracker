
function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function renderSessionHeaderTemplate(email: string): string {
  const safeEmail = escapeHtml(email);

  return `
    <header class="session-header">
      <div class="session-account">
        <span
          class="session-email"
          title="${safeEmail}"
        >${safeEmail}</span>

        <details class="session-menu">
          <summary
            class="session-menu-trigger"
            aria-label="Opciones de cuenta"
            title="Opciones de cuenta"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </summary>

          <div class="session-menu-dropdown">
            <button
              type="button"
              class="session-logout-button"
              data-auth-action="logout"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
              </svg>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </details>
      </div>
    </header>
  `;
}
