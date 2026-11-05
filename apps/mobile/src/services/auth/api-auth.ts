import { config } from '../api/config';
import { AuthFailure, AuthMessageError, type AuthUser } from '../storage/auth';

/**
 * Authentication against apps/api.
 *
 * The org is configuration (`expo.extra.orgSlug`), not user input: an internal
 * store is deployed per company, so asking an employee to type their org slug
 * would be asking them to know an implementation detail.
 */
export interface ApiSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken?: string;
  /**
   * Present since the API started returning the signed-in user alongside the
   * tokens. Optional here so an older API still authenticates rather than
   * failing to parse — the name simply falls back to the address.
   */
  user?: { id: string; email: string; displayName: string; role: string };
}

/** Claims the API puts on the access token. */
interface AccessClaims {
  sub: string;
  orgId: string;
  email?: string;
}

declare const atob: (data: string) => string;

const decodeClaims = (token: string): AccessClaims => {
  const payload = token.split('.')[1] ?? '';
  // atob is a Hermes global; Node's Buffer is not available in the app runtime.
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized)) as AccessClaims;
};

const unreachable = () =>
  new AuthMessageError(
    `Could not reach the server at ${config.apiBaseUrl}. Check your connection and try again.`,
  );

const tooManyAttempts = () =>
  new AuthMessageError('Too many attempts. Wait a minute and try again.');

/**
 * The first human-readable reason in an error body from the API.
 *
 * Validation failures from nestjs-zod carry their reasons in `errors[]`
 * ("password must contain a number"); every other Nest exception carries one
 * in `message`, which is a string or, for class-validator style errors, a
 * list of strings.
 */
const serverReason = async (response: Response): Promise<string | null> => {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      errors?: Array<{ message?: unknown }>;
    };
    const fromIssues = body.errors?.find((issue) => typeof issue?.message === 'string')?.message;
    if (typeof fromIssues === 'string') return fromIssues;
    if (typeof body.message === 'string' && body.message !== 'Validation failed') {
      return body.message;
    }
    if (Array.isArray(body.message) && typeof body.message[0] === 'string') {
      return body.message[0];
    }
  } catch {
    // Not JSON, e.g. a proxy's HTML error page. Fall through to the status.
  }
  return null;
};

const capitalize = (text: string): string =>
  text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;

/**
 * Creates an account in this install's organization (POST /auth/register).
 *
 * The API makes the person a `viewer` with no apps granted and returns no
 * tokens on purpose, so the caller signs in afterwards with the same
 * credentials. The org comes from configuration, as it does for sign-in.
 */
export const apiRegister = async (input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> => {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new AuthFailure('missing-name');

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgSlug: config.orgSlug,
        email,
        password: input.password,
        displayName: name,
      }),
    });
  } catch {
    throw unreachable();
  }

  if (response.ok) return;
  if (response.status === 409) throw new AuthFailure('email-taken');
  if (response.status === 429) throw tooManyAttempts();
  if (response.status === 404) {
    throw new AuthMessageError(
      'Registration is not open for this organization. Ask your platform team for an account.',
    );
  }
  if (response.status === 400) {
    const reason = await serverReason(response);
    throw reason
      ? new AuthMessageError(`${capitalize(reason)}.`.replace(/\.\.$/, '.'))
      : new AuthMessageError('Check your details and try again.');
  }
  throw new AuthMessageError(`Registration failed (${response.status}). Try again.`);
};

export type RefreshResult =
  | { kind: 'renewed'; tokens: { accessToken: string; refreshToken?: string } }
  /** The API refused the token: the session is over and must not be retried. */
  | { kind: 'rejected' }
  /**
   * Could not get an answer — offline, timed out, throttled, a 5xx. The token
   * may well still be good, so it is kept. Treating this like a rejection is
   * how a phone in a lift used to sign its owner out.
   */
  | { kind: 'unavailable' };

/** How long a refresh may take before it counts as unavailable. */
const REFRESH_TIMEOUT_MS = 15000;

/** Exchanges a refresh token for a new pair. */
export const apiRefresh = async (refreshToken: string): Promise<RefreshResult> => {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return { kind: 'unavailable' };
  }

  if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
  if (!response.ok) return { kind: 'unavailable' };

  try {
    const tokens = (await response.json()) as TokenPair;
    if (!tokens.accessToken) return { kind: 'unavailable' };
    return {
      kind: 'renewed',
      tokens: {
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      },
    };
  } catch {
    return { kind: 'unavailable' };
  }
};

/**
 * Revokes the refresh token server-side. Without this, "sign out" only forgot
 * the token on the phone and left a 30-day credential valid on the server.
 * Best effort: sign-out must never wait on, or fail because of, the network.
 */
export const apiLogout = async (refreshToken: string): Promise<void> => {
  try {
    await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // The session still expires on its own; nothing more to do from here.
  }
};

export const apiSignIn = async (
  email: string,
  password: string,
): Promise<ApiSession> => {
  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${config.apiPrefix}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgSlug: config.orgSlug,
        email: email.trim().toLowerCase(),
        password,
      }),
    });
  } catch {
    throw unreachable();
  }

  if (response.status === 429) throw tooManyAttempts();
  if (response.status === 401 || response.status === 400) {
    throw new AuthFailure('invalid-credentials');
  }
  if (!response.ok) {
    throw new AuthMessageError(`Sign-in failed (${response.status}). Try again.`);
  }

  const tokens = (await response.json()) as TokenPair;
  const claims = decodeClaims(tokens.accessToken);

  return {
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    user: {
      id: tokens.user?.id ?? claims.sub,
      // The display name, not the address. `name` used to be the email, which
      // is fine as an identifier and wrong as a greeting: "Hello,
      // someone@company.com" reads like a mail merge.
      name: tokens.user?.displayName || claims.email || email,
      email: tokens.user?.email ?? claims.email ?? email,
      createdAt: new Date().toISOString(),
    },
  };
};
