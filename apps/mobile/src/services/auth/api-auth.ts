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

/**
 * Exchanges a refresh token for a new pair. `'spent'` means the server refused
 * it (the session is over); null means we could not tell, e.g. no network.
 */
export const apiRefresh = async (
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string } | 'spent' | null> => {
  try {
    const response = await fetch(
      `${config.apiBaseUrl}${config.apiPrefix}/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
    );
    if (response.status === 400 || response.status === 401) return 'spent';
    if (!response.ok) return null;
    return (await response.json()) as TokenPair;
  } catch {
    return null;
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
