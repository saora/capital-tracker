
const GOOGLE_SHEETS_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  GOOGLE_SHEETS_SCOPE,
].join(' ');

const AUTHORIZED_EMAIL = 'saora.mx@gmail.com';
const TOKEN_EXPIRATION_BUFFER_MS = 60_000;

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

  revoke(token: string, callback?: () => void): void;
}

interface GoogleTokenResult {
  accessToken: string;
  expiresIn: number;
}

let activeAccessToken: string | null = null;
let authenticatedEmail: string | null = null;
let accessTokenExpiresAt: number | null = null;

let pendingLogin: Promise<string> | null = null;
let pendingTokenRefresh: Promise<string> | null = null;
let tokenExpirationTimer: number | null = null;

function clearTokenExpirationTimer(): void {
  if (tokenExpirationTimer !== null) {
    window.clearTimeout(tokenExpirationTimer);
    tokenExpirationTimer = null;
  }
}

function getGoogleOAuth2(): GoogleOAuth2 {
  const oauth2 = window.google?.accounts?.oauth2;

  if (!oauth2) {
    throw new Error(
      'Google Identity Services no está disponible. ' +
        'Recarga la página e inténtalo nuevamente.',
    );
  }

  return oauth2 as GoogleOAuth2;
}

function getClientId(): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'Falta configurar VITE_GOOGLE_CLIENT_ID. ' +
        'Verifica las variables de entorno de GitHub Actions.',
    );
  }

  return GOOGLE_CLIENT_ID;
}

function requestGoogleToken(
  prompt?: string,
): Promise<GoogleTokenResult> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const rejectOnce = (error: Error) => {
      if (settled) return;

      settled = true;
      reject(error);
    };

    try {
      const oauth2 = getGoogleOAuth2();

      const tokenClient = oauth2.initTokenClient({
        client_id: getClientId(),
        scope: GOOGLE_SCOPES,

        callback: (response: GoogleTokenResponse) => {
          if (settled) return;

          if (response.error) {
            rejectOnce(
              new Error(
                response.error_description ??
                  `Error de autenticación de Google: ${response.error}`,
              ),
            );
            return;
          }

          if (!response.access_token) {
            rejectOnce(
              new Error(
                'Google no devolvió un token de acceso válido.',
              ),
            );
            return;
          }

          const expiresIn = Number(response.expires_in ?? 3600);

          if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
            rejectOnce(
              new Error(
                'Google devolvió un tiempo de expiración inválido.',
              ),
            );
            return;
          }

          settled = true;

          resolve({
            accessToken: response.access_token,
            expiresIn,
          });
        },

        error_callback: (error) => {
          rejectOnce(
            new Error(
              error.message ||
                error.type ||
                'No fue posible completar la autenticación con Google.',
            ),
          );
        },
      });

      tokenClient.requestAccessToken(
        prompt !== undefined ? { prompt } : {},
      );
    } catch (error) {
      rejectOnce(
        error instanceof Error
          ? error
          : new Error('Error al iniciar la autenticación con Google.'),
      );
    }
  });
}

async function verifyAuthorizedUser(
  accessToken: string,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch {
    throw new Error(
      'No fue posible verificar tu cuenta de Google. ' +
        'Comprueba tu conexión e inténtalo nuevamente.',
    );
  }

  if (!response.ok) {
    throw new Error(
      `No fue posible verificar tu cuenta de Google (${response.status}).`,
    );
  }

  const user = (await response.json()) as {
    email?: string;
    email_verified?: boolean;
  };

  const email = user.email?.trim().toLowerCase();

  if (!email || user.email_verified !== true) {
    throw new Error(
      'Google no pudo confirmar el correo electrónico de la cuenta.',
    );
  }

  if (email !== AUTHORIZED_EMAIL.toLowerCase()) {
    throw new Error(
      `Acceso restringido. Inicia sesión con ${AUTHORIZED_EMAIL}.`,
    );
  }

  return email;
}

function saveToken(
  accessToken: string,
  email: string,
  expiresIn: number,
): void {
  clearTokenExpirationTimer();

  activeAccessToken = accessToken;
  authenticatedEmail = email;
  accessTokenExpiresAt = Date.now() + expiresIn * 1000;

  tokenExpirationTimer = window.setTimeout(() => {
    if (activeAccessToken !== accessToken) return;

    signOutFromGoogle();
    window.dispatchEvent(new Event('google-session-expired'));
  }, expiresIn * 1000);
}

/**
 * Inicia sesión con Google y valida la cuenta autorizada.
 * Las solicitudes simultáneas comparten el mismo proceso de login.
 */
export async function signInWithGoogle(): Promise<string> {
  if (pendingLogin) {
    return pendingLogin;
  }

  pendingLogin = (async () => {
    let accessToken: string | null = null;

    try {
      const tokenResult = await requestGoogleToken();

      accessToken = tokenResult.accessToken;

      const email = await verifyAuthorizedUser(accessToken);

      saveToken(
        accessToken,
        email,
        tokenResult.expiresIn,
      );

      return accessToken;
    } catch (error) {
      activeAccessToken = null;
      authenticatedEmail = null;
      accessTokenExpiresAt = null;

      if (accessToken) {
        try {
          getGoogleOAuth2().revoke(accessToken);
        } catch {
          // No reemplazar el error original si falla la revocación.
        }
      }

      throw error instanceof Error
        ? error
        : new Error('No fue posible iniciar sesión con Google.');
    }
  })();

  try {
    return await pendingLogin;
  } finally {
    pendingLogin = null;
  }
}

/**
 * Solicita un token nuevo sin mostrar el selector de cuenta
 * inicialmente. Google puede requerir interacción del usuario.
 */
export async function refreshGoogleAccessToken(): Promise<string> {
  if (pendingTokenRefresh) {
    return pendingTokenRefresh;
  }

  pendingTokenRefresh = (async () => {
    let accessToken: string | null = null;

    try {
      const tokenResult = await requestGoogleToken('');

      accessToken = tokenResult.accessToken;

      const email = await verifyAuthorizedUser(accessToken);

      saveToken(
        accessToken,
        email,
        tokenResult.expiresIn,
      );

      return accessToken;
    } catch (error) {
      activeAccessToken = null;
      authenticatedEmail = null;
      accessTokenExpiresAt = null;

      if (accessToken) {
        try {
          getGoogleOAuth2().revoke(accessToken);
        } catch {
          // Conservar el error original.
        }
      }

      throw error instanceof Error
        ? error
        : new Error('No fue posible renovar la sesión de Google.');
    }
  })();

  try {
    return await pendingTokenRefresh;
  } finally {
    pendingTokenRefresh = null;
  }
}

/**
 * Devuelve el token actual si todavía es válido.
 * Si está próximo a expirar, intenta renovarlo.
 */
export async function getValidAccessToken(): Promise<string> {
  if (!activeAccessToken) {
    return signInWithGoogle();
  }

  const expiresSoon =
    accessTokenExpiresAt !== null &&
    accessTokenExpiresAt <=
      Date.now() + TOKEN_EXPIRATION_BUFFER_MS;

  if (expiresSoon) {
    return refreshGoogleAccessToken();
  }

  return activeAccessToken;
}

export function getAuthenticatedEmail(): string | null {
  return authenticatedEmail;
}

export function getActiveAccessToken(): string | null {
  return activeAccessToken;
}

/**
 * Cierra la sesión local de la aplicación.
 * No revoca el consentimiento de Google.
 */
export function signOutFromGoogle(): void {
  clearTokenExpirationTimer();
  activeAccessToken = null;
  authenticatedEmail = null;
  accessTokenExpiresAt = null;
}
