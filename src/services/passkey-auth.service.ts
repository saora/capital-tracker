
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

const WORKER_URL =
  'https://capital-tracker-auth.saora.workers.dev';

interface WorkerError {
  error?: string;
  passkeyRegistered?: boolean;
}

interface WorkerSessionResponse {
  verified?: boolean;
  authenticated?: boolean;
  setupToken?: string;
  sessionToken?: string;
  expiresAt?: number;
  passkeyRegistered?: boolean;
  error?: string;
}

interface WebAuthnOptionsResponse {
  options: Record<string, unknown>;
  challengeId: string;
}

let activeSessionToken: string | null = null;
let activeSessionExpiresAt: number | null = null;

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function workerRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST';
    token?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${WORKER_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
  } catch {
    throw new Error(
      'No fue posible conectar con el servicio de autenticación. Comprueba tu conexión e inténtalo nuevamente.',
    );
  }

  const data = await readJson<T & WorkerError>(response);

  if (!response.ok) {
    throw new Error(
      data.error ??
        `Error del servicio de autenticación (${response.status}).`,
    );
  }

  return data;
}

function saveSession(data: WorkerSessionResponse): void {
  if (
    !data.sessionToken ||
    typeof data.expiresAt !== 'number' ||
    !Number.isFinite(data.expiresAt)
  ) {
    throw new Error(
      'El servicio no devolvió una sesión válida.',
    );
  }

  activeSessionToken = data.sessionToken;
  activeSessionExpiresAt = data.expiresAt;
}

function clearSession(): void {
  activeSessionToken = null;
  activeSessionExpiresAt = null;
}

export function hasActivePasskeySession(): boolean {
  return Boolean(
    activeSessionToken &&
      activeSessionExpiresAt !== null &&
      activeSessionExpiresAt > Math.floor(Date.now() / 1000),
  );
}

export function clearPasskeySession(): void {
  clearSession();
}

export async function validatePasskeySession(): Promise<boolean> {
  if (!hasActivePasskeySession() || !activeSessionToken) {
    clearSession();
    return false;
  }

  try {
    const result = await workerRequest<WorkerSessionResponse>(
      '/auth/session',
      {
        method: 'GET',
        token: activeSessionToken,
      },
    );

    if (result.authenticated !== true) {
      clearSession();
      return false;
    }

    return true;
  } catch {
    clearSession();
    return false;
  }
}

async function registerPasskey(
  setupToken: string,
): Promise<WorkerSessionResponse> {
  const optionsResponse =
    await workerRequest<WebAuthnOptionsResponse>(
      '/passkeys/register/options',
      {
        method: 'POST',
        token: setupToken,
      },
    );

  if (
    !optionsResponse.options ||
    !optionsResponse.challengeId
  ) {
    throw new Error(
      'El servicio no devolvió las opciones para registrar la passkey.',
    );
  }

  const credential = await startRegistration({
    optionsJSON: optionsResponse.options as never,
  });

  return workerRequest<WorkerSessionResponse>(
    '/passkeys/register/verify',
    {
      method: 'POST',
      token: setupToken,
      body: {
        response: credential,
        challengeId: optionsResponse.challengeId,
      },
    },
  );
}

async function authenticatePasskey(): Promise<WorkerSessionResponse> {
  const optionsResponse =
    await workerRequest<WebAuthnOptionsResponse>(
      '/passkeys/authenticate/options',
      {
        method: 'POST',
      },
    );

  if (
    !optionsResponse.options ||
    !optionsResponse.challengeId
  ) {
    throw new Error(
      'El servicio no devolvió las opciones para autenticar la passkey.',
    );
  }

  const credential = await startAuthentication({
    optionsJSON: optionsResponse.options as never,
  });

  return workerRequest<WorkerSessionResponse>(
    '/passkeys/authenticate/verify',
    {
      method: 'POST',
      body: {
        response: credential,
        challengeId: optionsResponse.challengeId,
      },
    },
  );
}

/**
 * Primer acceso:
 * Google -> setupToken -> registro de passkey -> sesión.
 *
 * Accesos posteriores:
 * Google -> autenticación con passkey -> sesión.
 */
export async function establishPasskeySession(
  googleAccessToken: string,
): Promise<void> {
  clearSession();

  let response: Response;

  try {
    response = await fetch(`${WORKER_URL}/auth/google`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: googleAccessToken,
      }),
    });
  } catch {
    throw new Error(
      'No fue posible conectar con el servicio de autenticación.',
    );
  }

  const googleResult =
    await readJson<WorkerSessionResponse>(response);

  let sessionResult: WorkerSessionResponse;

  if (
    response.status === 409 &&
    googleResult.passkeyRegistered === true
  ) {
    sessionResult = await authenticatePasskey();
  } else if (!response.ok) {
    throw new Error(
      googleResult.error ??
        `No fue posible verificar el acceso (${response.status}).`,
    );
  } else {
    if (!googleResult.setupToken) {
      throw new Error(
        'El servicio no devolvió el token necesario para registrar la passkey.',
      );
    }

    sessionResult = await registerPasskey(
      googleResult.setupToken,
    );
  }

  if (sessionResult.verified !== true) {
    throw new Error(
      'No se pudo verificar la autenticación biométrica.',
    );
  }

  saveSession(sessionResult);

  const isValid = await validatePasskeySession();

  if (!isValid) {
    clearSession();
    throw new Error(
      'La sesión no pudo validarse. Vuelve a iniciar sesión.',
    );
  }
}
