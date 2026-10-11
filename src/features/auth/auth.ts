
import { renderLoginTemplate } from './templates/login.template';
import { renderSessionHeaderTemplate } from './templates/session-header.template';

import {
  getActiveAccessToken,
  getAuthenticatedEmail,
  signInWithGoogle,
  signOutFromGoogle,
} from '../../services/google-auth.service';

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

export function getSessionAccessToken(): string | null {
  return getActiveAccessToken();
}

export async function startGoogleSession(): Promise<string> {
  return signInWithGoogle();
}

export async function endGoogleSession(): Promise<void> {
  await signOutFromGoogle();
}
