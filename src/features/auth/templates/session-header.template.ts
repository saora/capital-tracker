
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });
}

export function renderSessionHeaderTemplate(email: string): string {
  return `
    <header class="session-header">
      <div class="session-account">
        <div class="session-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </div>

        <div class="session-account-info">
          <span class="session-label">Sesión activa</span>
          <span class="session-email">${escapeHtml(email)}</span>
        </div>
      </div>

      <button
        type="button"
        class="session-logout-button"
        data-auth-action="logout"
        aria-label="Cerrar sesión"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 17l5-5-5-5" />
          <path d="M15 12H3" />
          <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
        <span>Cerrar sesión</span>
      </button>
    </header>
  `;
}
