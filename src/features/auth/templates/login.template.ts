
export interface LoginTemplateOptions {
  errorMessage?: string;
  isLoading?: boolean;
}

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

export function renderLoginTemplate(
  options: LoginTemplateOptions = {},
): string {
  const { errorMessage = '', isLoading = false } = options;

  const errorHtml = errorMessage
    ? `<p class="auth-error" role="alert">${escapeHtml(errorMessage)}</p>`
    : '';

  return `
    <section class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 17l6-6 4 4 8-9" />
              <path d="M15 6h6v6" />
            </svg>
          </div>

          <h1>Capital Tracker</h1>
          <p>Tu patrimonio, en un solo lugar.</p>
        </div>

        <div class="auth-divider"></div>

        <h2>Bienvenido</h2>
        <p class="auth-description">
          Inicia sesión para consultar tu portafolio de inversiones.
        </p>

        ${errorHtml}

        <button
          type="button"
          class="auth-google-button"
          data-auth-action="login"
          ${isLoading ? 'disabled' : ''}
        >
          <svg
            class="auth-google-icon"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path fill="#4285F4" d="M43.6 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-9 6-15.5Z"/>
            <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/>
            <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 17.9l6.9-5.2Z"/>
            <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z"/>
          </svg>

          <span>
            ${isLoading ? 'Conectando con Google…' : 'Continuar con Google'}
          </span>
        </button>

        <p class="auth-security-note">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Acceso limitado a la cuenta autorizada.
        </p>
      </div>
    </section>
  `;
}
