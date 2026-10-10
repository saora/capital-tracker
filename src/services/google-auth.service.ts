const GOOGLE_SHEETS_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  GOOGLE_SHEETS_SCOPE,
].join(' ');

const AUTHORIZED_EMAIL = 'saora.mx@gmail.com';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  scope?: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(options: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: {
      type?: string;
      message?: string;
    }) => void;
  }): GoogleTokenClient;

  revoke(
    token: string,
    callback?: () => void,
  ): void;
}

let activeAccessToken: string | null = null;
let authenticatedEmail: string | null = null;
let pendingLogin: Promise<string> | null = null;

function getGoogleOAuth2(): GoogleOAuth2 {
  const oauth2 = window.google?.accounts?.oauth2;

  if (!oauth2) {
    throw new Error(
      'Google Identity Services no está disponible. Recarga la página e inténtalo de nuevo.',
    );
  }

  return oauth2 as GoogleOAuth2;
}

function getClientId(): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'Falta VITE_GOOGLE_CLIENT_ID. Configura esta variable en el entorno de despliegue.',
    );
  }

  return GOOGLE_CLIENT_ID;
}

async function verifyAuthorizedUser(
  accessToken: string,
): Promise<string> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `No fue posible verificar la cuenta de Google (${response.status}).`,
    );
  }

  const user = (await response.json()) as {
    email?: string;
    email_verified?: boolean;
  };

  const email = user.email?.trim().toLowerCase();

  if (!email || user.email_verified !== true) {
    throw new Error(
      'Google no pudo verificar la dirección de correo de la cuenta.',
    );
  }

  if (email !== AUTHORIZED_EMAIL.toLowerCase()) {
    throw new Error(
      `Acceso restringido. Inicia sesión con ${AUTHORIZED_EMAIL}.`,
    );
  }

  return email;
}

function requestGoogleToken(prompt?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finishWithError = (error: Error): void => {
      if (settled) return;

      settled = true;
      reject(error);
    };

    try {
      const oauth2 = getGoogleOAuth2();
      const clientId = getClientId();

      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES,

        callback: (response: GoogleTokenResponse) => {
          if (settled) return;

          if (response.error) {
            finishWithError(
              new Error(
                response.error_description ||
                  `Error de autorización de Google: ${response.error}`,
              ),
            );
            return;
          }

          if (!response.access_token) {
            finishWithError(
              new Error(
                'Google no devolvió un token de acceso válido.',
              ),
            );
            return;
          }

          settled = true;
          resolve(response.access_token);
        },

        error_callback: (error) => {
          finishWithError(
            new Error(
              error.message ||
                'No se pudo completar la autorización de Google.',
            ),
          );
        },
      });

      tokenClient.requestAccessToken(
  prompt ? { prompt } : {},
);
    } catch (error) {
      finishWithError(
        error instanceof Error
          ? error
          : new Error('No fue posible iniciar sesión con Google.'),
      );
    }
  });
}

export async function signInWithGoogle(): Promise<string> {
  if (pendingLogin) {
    return pendingLogin;
  }

  pendingLogin = (async () => {
    const accessToken = await requestGoogleToken();

    try {
      const email = await verifyAuthorizedUser(accessToken);

      activeAccessToken = accessToken;
      authenticatedEmail = email;

      return accessToken;
    } catch (error) {
      activeAccessToken = null;
      authenticatedEmail = null;

      // Revocar el token rechazado, sin afectar otros inicios
      // de sesión de la aplicación.
      try {
        getGoogleOAuth2().revoke(accessToken);
      } catch {
        // La validación original sigue siendo el error principal.
      }

      throw error;
    }
  })();

  try {
    return await pendingLogin;
  } finally {
    pendingLogin = null;
  }
}

export function getAuthenticatedEmail(): string | null {
  return authenticatedEmail;
}

export function getActiveAccessToken(): string | null {
  return activeAccessToken;
}

export function signOutFromGoogle(): void {
  // Cierra la sesión local de Capital Tracker.
  // No revoca el consentimiento OAuth de Google.
  activeAccessToken = null;
  authenticatedEmail = null;
}