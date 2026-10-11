
import { renderLoginTemplate } from './templates/login.template';
import { renderSessionHeaderTemplate } from './templates/session-header.template';

import {
  getActiveAccessToken,
  getAuthenticatedEmail,
  signInWithGoogle,
  signOutFromGoogle,
} from '../../services/google-auth.service';

import {
  clearPasskeySession,
  establishPasskeySession,
  hasActivePasskeySession,
} from '../../services/passkey-auth.service';

export function renderLoginView(
  errorMessage = '',
  isLoading = false,
): string {
  return renderLoginTemplate({
    errorMessage,
    isLoading,
  });
}

export function renderAuthenticatedHeader(): string {
  const email = getAuthenticatedEmail();

  if (!email) {
    return '';
  }

  return renderSessionHeaderTemplate(email);
}

/** Token de Google requerido por Google Sheets. */
export function getSessionAccessToken(): string | null {
  return getActiveAccessToken();
}

/** Comprueba si ambos estados de autenticación están activos. */
export function hasActiveAppSession(): boolean {
  return Boolean(
    getActiveAccessToken() &&
      getAuthenticatedEmail() &&
      hasActivePasskeySession(),
  );
}

export async function startGoogleSession(): Promise<string> {
  return signInWithGoogle();
}

export async function startPasskeySession(
  googleAccessToken: string,
): Promise<void> {
  await establishPasskeySession(googleAccessToken);
}

export async function endGoogleSession(): Promise<void> {
  clearPasskeySession();
  signOutFromGoogle();
}
