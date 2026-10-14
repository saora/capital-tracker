export const GOOGLE_SHEETS_RATE_LIMIT_MESSAGE =
  'No se pudo actualizar tu portafolio. Estamos recibiendo muchas solicitudes en este momento. Espera unos segundos e inténtalo de nuevo.';

const DEFAULT_RATE_LIMIT_RETRY_MS = 30_000;

export class GoogleApiError extends Error {
  readonly status: number;
  readonly retryAfterMs: number;
  readonly technicalMessage: string;

  constructor(
    status: number,
    technicalMessage: string,
    retryAfterMs = 0,
  ) {
    super(technicalMessage);
    this.name = 'GoogleApiError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.technicalMessage = technicalMessage;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryDate = Date.parse(value);
  if (!Number.isFinite(retryDate)) return null;

  return Math.max(0, retryDate - Date.now());
}

export async function createGoogleApiError(
  response: Response,
  serviceName = 'Google Sheets',
): Promise<GoogleApiError> {
  let responseBody = '';

  try {
    responseBody = await response.text();
  } catch {
    responseBody = 'No se pudo leer el detalle de la respuesta.';
  }

  const technicalMessage = responseBody
    ? `${serviceName} respondió ${response.status}: ${responseBody}`
    : `${serviceName} respondió ${response.status}.`;

  const retryAfterMs = response.status === 429
    ? Math.max(
        1_000,
        parseRetryAfter(response.headers.get('Retry-After')) ??
          DEFAULT_RATE_LIMIT_RETRY_MS,
      )
    : 0;

  return new GoogleApiError(
    response.status,
    technicalMessage,
    retryAfterMs,
  );
}
