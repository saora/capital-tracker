const GOOGLE_SHEETS_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets';

let pendingRequest:
  | {
      resolve: (token: string) => void;
      reject: (error: Error) => void;
    }
  | undefined;

export function signInWithGoogle(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const google = window.google;

  if (!clientId) {
    return Promise.reject(
      new Error(
        'Falta VITE_GOOGLE_CLIENT_ID en el archivo .env.local.',
      ),
    );
  }

  if (!google?.accounts?.oauth2) {
    return Promise.reject(
      new Error(
        'Google Identity Services todavía no está disponible. Recarga la página e inténtalo nuevamente.',
      ),
    );
  }

  if (pendingRequest) {
    return Promise.reject(
      new Error('Ya existe una solicitud de autorización en curso.'),
    );
  }

  return new Promise<string>((resolve, reject) => {
    pendingRequest = { resolve, reject };

    try {
      const tokenClient =
        google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SHEETS_SCOPE,

          callback: (response: GoogleTokenResponse) => {
            const request = pendingRequest;
            pendingRequest = undefined;

            if (!request) return;

            if (
              response.error ||
              !response.access_token
            ) {
              request.reject(
                new Error(
                  response.error_description ||
                    response.error ||
                    'No fue posible autorizar el acceso a Google Sheets.',
                ),
              );
              return;
            }

            request.resolve(response.access_token);
          },

          error_callback: (error) => {
            const request = pendingRequest;
            pendingRequest = undefined;

            request?.reject(
              new Error(
                error.message ||
                  'Falló la ventana de autorización de Google.',
              ),
            );
          },
        });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (error) {
      pendingRequest = undefined;

      reject(
        error instanceof Error
          ? error
          : new Error(
              'No se pudo iniciar la autorización de Google.',
            ),
      );
    }
  });
}