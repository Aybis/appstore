import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { apiRefresh } from './api-auth';

/**
 * The API session: access + refresh token, where they live, and how they are
 * renewed.
 *
 * WHY THIS MODULE EXISTS. Users were being signed out after the app sat in the
 * background for a while, although the API issues a 30-day refresh token. The
 * access token lives 15 minutes, so on resume every screen's first request got
 * a 401 at once, and every one of them redeemed the SAME refresh token in
 * parallel. The API rotates on every refresh and treats a second redemption of
 * a rotated token as theft, revoking the whole chain — so the app signed itself
 * out by being busy. The three fixes below each close one part of that:
 *
 *   1. Single flight. Concurrent callers share one refresh request.
 *   2. Refresh ahead of expiry. The token is renewed before a request is sent
 *      with one that is about to lapse, and when the app returns to the
 *      foreground — so the 401 storm does not start in the first place.
 *   3. Network failure is not rejection. Only a refusal from the API ends the
 *      session; a dropped connection keeps the tokens for the next attempt.
 */

const ACCESS_KEY = 'maya.access.v2';
const REFRESH_KEY = 'maya.refresh.v2';

/** Where the tokens lived before SecureStore. Read once, then deleted. */
const LEGACY_ACCESS_KEY = 'maya.token.v1';
const LEGACY_REFRESH_KEY = 'maya.refresh.v1';

/**
 * Renew this long before the access token expires. Covers clock skew between
 * phone and server, and the request's own time on the wire.
 */
const EXPIRY_SKEW_SECONDS = 60;

/**
 * The refresh token is a 30-day credential, so it belongs in the Keychain /
 * Android Keystore rather than AsyncStorage, which is a plain file any rooted
 * device or unencrypted backup can read. AFTER_FIRST_UNLOCK so a refresh that
 * runs while the phone is locked (a background fetch, a notification tap)
 * still works; THIS_DEVICE_ONLY so it never travels to another phone in a
 * backup.
 */
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

let accessToken: string | null = null;
let refreshToken: string | null = null;
let inflight: Promise<RenewOutcome> | null = null;

type RenewOutcome = 'renewed' | 'rejected' | 'unavailable';

type ExpiredListener = () => void;
const expiredListeners = new Set<ExpiredListener>();

/**
 * Called when the API has refused the refresh token, i.e. the session is over
 * for real (signed out elsewhere, offboarded, revoked). AuthProvider uses it to
 * show the sign-in screen instead of leaving a catalog that 401s on every read.
 */
export const onSessionExpired = (listener: ExpiredListener): (() => void) => {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
};

const readSecure = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key, secureOptions);
  } catch {
    // Keystore entries can become undecryptable after a backup restore or a
    // lock-screen change. Unreadable is the same as absent: sign in again.
    return null;
  }
};

const writeSecure = async (key: string, value: string | null): Promise<void> => {
  try {
    if (value) await SecureStore.setItemAsync(key, value, secureOptions);
    else await SecureStore.deleteItemAsync(key, secureOptions);
  } catch {
    // Keeping the in-memory copy is still better than failing the sign-in.
  }
};

/** Loads the stored tokens into memory, moving any legacy copies first. */
export const loadSession = async (): Promise<string | null> => {
  let [access, refresh] = await Promise.all([readSecure(ACCESS_KEY), readSecure(REFRESH_KEY)]);

  if (!access && !refresh) {
    const [legacyAccess, legacyRefresh] = await Promise.all([
      AsyncStorage.getItem(LEGACY_ACCESS_KEY),
      AsyncStorage.getItem(LEGACY_REFRESH_KEY),
    ]);
    if (legacyAccess || legacyRefresh) {
      access = legacyAccess;
      refresh = legacyRefresh;
      await Promise.all([writeSecure(ACCESS_KEY, access), writeSecure(REFRESH_KEY, refresh)]);
    }
  }
  // Always, so no plaintext copy outlives the upgrade.
  await AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]);

  accessToken = access;
  refreshToken = refresh;
  return accessToken;
};

export const saveSession = async (tokens: {
  accessToken: string;
  refreshToken?: string | undefined;
}): Promise<void> => {
  accessToken = tokens.accessToken;
  if (tokens.refreshToken) refreshToken = tokens.refreshToken;
  await Promise.all([
    writeSecure(ACCESS_KEY, accessToken),
    tokens.refreshToken ? writeSecure(REFRESH_KEY, tokens.refreshToken) : Promise.resolve(),
  ]);
};

export const clearSession = async (): Promise<void> => {
  accessToken = null;
  refreshToken = null;
  inflight = null;
  await Promise.all([
    writeSecure(ACCESS_KEY, null),
    writeSecure(REFRESH_KEY, null),
    AsyncStorage.multiRemove([LEGACY_ACCESS_KEY, LEGACY_REFRESH_KEY]),
  ]);
};

/** The current access token as-is, without checking its expiry. */
export const currentAccessToken = (): string | null => accessToken;

/** The refresh token, for sign-out to revoke it server-side. */
export const currentRefreshToken = (): string | null => refreshToken;

declare const atob: (data: string) => string;

/** Seconds-since-epoch expiry of a JWT, or null when it cannot be read. */
const expiryOf = (token: string): number | null => {
  try {
    const payload = token.split('.')[1] ?? '';
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const { exp } = JSON.parse(atob(padded)) as { exp?: number };
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
};

const isExpiring = (token: string): boolean => {
  const exp = expiryOf(token);
  // Unreadable: let the server decide, and the 401 path handle it.
  if (exp === null) return false;
  return exp - Date.now() / 1000 <= EXPIRY_SKEW_SECONDS;
};

const doRenew = async (): Promise<RenewOutcome> => {
  const presented = refreshToken;
  if (!presented) return 'rejected';

  const result = await apiRefresh(presented);
  if (result.kind === 'unavailable') return 'unavailable';

  if (result.kind === 'rejected') {
    // Only end the session if nobody replaced the token while we were waiting
    // (a sign-in in another code path). Otherwise this refusal is stale news.
    if (refreshToken === presented) {
      await clearSession();
      expiredListeners.forEach((listener) => listener());
    }
    return 'rejected';
  }

  await saveSession(result.tokens);
  return 'renewed';
};

/**
 * Exchanges the refresh token for a new pair. Every concurrent caller awaits
 * the SAME request — redeeming one refresh token twice is what the API reads
 * as theft. Returns the new access token, or null if renewal did not succeed.
 */
export const renewAccessToken = async (): Promise<string | null> => {
  if (!inflight) {
    inflight = doRenew().finally(() => {
      inflight = null;
    });
  }
  const outcome = await inflight;
  return outcome === 'renewed' ? accessToken : null;
};

/**
 * The access token to send right now: renewed first if it is about to expire.
 * When renewal is merely unavailable (offline), the old token is returned and
 * the request is left to fail or succeed on its own.
 */
export const freshAccessToken = async (): Promise<string | null> => {
  const token = accessToken;
  if (!token || !isExpiring(token)) return token;
  return (await renewAccessToken()) ?? accessToken;
};
