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
    <header class="session-header" aria-label="Cuenta activa">
      <span class="session-email" title="${safeEmail}">${safeEmail}</span>
    </header>
  `;
}
