
const GOOGLE_SHEETS_SCOPE =
  'openid email profile https://www.googleapis.com/auth/spreadsheets';

const AUTHORIZED_EMAIL = 'saora.mx@gmail.com';

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

let activeAccessToken: string | null = null;
let activeEmail: string | null = null;

let pendingRequest:
  | {
      resolve: (token: string) => void;
      reject: (error: Error) => void;
    }
  | undefined;

function getGoogleClient() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const google = window.google;

  if (!clientId) {
    throw new Error('Falta VITE_GOOGLE_CLIENT_ID en .env.local.');
  }

  if (!google?.accounts?.oauth2) {
    throw new Error(
      'Google Identity Services no está disponible. Recarga la página.',
    );
  }

  return { clientId, google };
}

async function verifyAuthorizedUser(token: string): Promise<string> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) {
    throw new Error('No se pudo verificar tu cuenta de Google.');
  }

  const user = (await response.json()) as GoogleUserInfo;
  const email = user.email?.trim().toLowerCase();

  if (!email || user.email_verified !== true) {
    throw new Error('Google no pudo verificar el correo de la cuenta.');
  }

  if (email !== AUTHORIZED_EMAIL) {
    throw new Error(
      `Acceso restringido. Inicia sesión con ${AUTHORIZED_EMAIL}.`,
    );
  }

  return email;
}

export function signInWithGoogle(): Promise<string> {
  let clientId: string;
  let google: ReturnType<typeof getGoogleClient>['google'];

  try {
    ({ clientId, google } = getGoogleClient());
  } catch (error) {
    return Promise.reject(
      error instanceof Error ? error : new Error('Error de autenticación.'),
    );
  }

  if (pendingRequest) {
    return Promise.reject(
      new Error('Ya existe una solicitud de autorización en curso.'),
    );
  }

  return new Promise<string>((resolve, reject) => {
    pendingRequest = { resolve, reject };

    const finishWithError = (error: Error) => {
      const request = pendingRequest;
      pendingRequest = undefined;
      request?.reject(error);
    };

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SHEETS_SCOPE,

        callback: async (response: GoogleTokenResponse) => {
          const request = pendingRequest;
          pendingRequest = undefined;

          if (!request) return;

          if (response.error || !response.access_token) {
            request.reject(
              new Error(
                response.error_description ||
                  response.error ||
                  'No fue posible autorizar el acceso a Google.',
              ),
            );
            return;
          }

          try {
            const email = await verifyAuthorizedUser(response.access_token);

            activeAccessToken = response.access_token;
            activeEmail = email;

            request.resolve(response.access_token);
          } catch (error) {
            google.accounts.oauth2.revoke(response.access_token, () => {});

            request.reject(
              error instanceof Error
                ? error
                : new Error('No fue posible verificar la cuenta.'),
            );
          }
        },

        error_callback: (error) => {
          finishWithError(
            new Error(
              error.message || 'Falló la ventana de autorización de Google.',
            ),
          );
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (error) {
      finishWithError(
        error instanceof Error
          ? error
          : new Error('No se pudo iniciar la autorización de Google.'),
      );
    }
  });
}

export function getAuthenticatedEmail(): string | null {
  return activeEmail;
}

export function getActiveAccessToken(): string | null {
  return activeAccessToken;
}

export function signOutFromGoogle(): void {
  const token = activeAccessToken;

  activeAccessToken = null;
  activeEmail = null;
  pendingRequest = undefined;

  if (!token || !window.google?.accounts?.oauth2) return;

  window.google.accounts.oauth2.revoke(token, () => {});
}
