import { config } from '../api/config';
import { AuthFailure, type AuthUser } from '../storage/auth';

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

/** Exchanges a refresh token for a new pair. Returns null when it is spent. */
export const apiRefresh = async (
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string } | null> => {
  try {
    const response = await fetch(
      `${config.apiBaseUrl}${config.apiPrefix}/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
    );
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
    throw new Error(`Could not reach the server at ${config.apiBaseUrl}.`);
  }

  if (response.status === 401 || response.status === 400) {
    throw new AuthFailure('invalid-credentials');
  }
  if (!response.ok) {
    throw new Error(`Sign-in failed (${response.status}).`);
  }

  const tokens = (await response.json()) as TokenPair;
  const claims = decodeClaims(tokens.accessToken);

  return {
    accessToken: tokens.accessToken,
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    user: {
      id: claims.sub,
      name: claims.email ?? email,
      email: claims.email ?? email,
      createdAt: new Date().toISOString(),
    },
  };
};
