import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { AppState } from 'react-native';

import { HttpAppProvider, MockAppProvider, setClient } from '../api';
import { bindTelemetryToken, checkIn, clearPushToken, registerDevice } from '../device/telemetry';
import { identify, resetIdentity, track } from '../telemetry';
import { config } from '../api/config';
import * as store from '../storage/auth';
import { AuthFailure, AuthMessageError, type AuthUser } from '../storage/auth';
import { apiLogout, apiRegister, apiSignIn } from './api-auth';
import * as session from './session';

/**
 * fetch() against the API as the signed-in person: adds a token that is not
 * about to expire, and on a 401 renews once and retries. Throws when there is
 * no session to use.
 */
export const authorizedFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const send = (token: string) =>
    fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });

  const token = await session.freshAccessToken();
  if (!token) throw new Error('Not signed in');
  const first = await send(token);
  if (first.status !== 401) return first;

  const renewed = await session.renewAccessToken();
  return renewed ? send(renewed) : first;
};

/**
 * Points the data layer at the API once a token exists, and back at the mock
 * provider on sign-out. Hooks resolve through getClient(), so no screen has to
 * know which provider is active.
 */
const bindClient = (signedIn: boolean): void => {
  // Telemetry reads the same token, through the same accessor, so it can never
  // drift from what the data client is using.
  bindTelemetryToken(session.currentAccessToken);
  if (config.useMockData) return;
  setClient(
    signedIn
      ? new HttpAppProvider(session.freshAccessToken, session.renewAccessToken)
      : new MockAppProvider(),
  );
};

type Status = 'loading' | 'signedIn' | 'signedOut';

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  status: Status;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Replaces the signed-in user after a profile edit, and remembers it. */
  updateUser: (next: AuthUser) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The single seam between the UI and however accounts are actually stored.
 * Today that is AsyncStorage (see storage/auth.ts); when the API ships, only
 * this provider changes — screens keep calling signIn/register/signOut.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      await store.seedDemoUser();
      const [profile, token] = await Promise.all([store.readSession(), session.loadSession()]);
      if (cancelled) return;

      // A session without a token is unusable against the API — treat it as
      // signed out rather than showing a catalog that will 401 on every read.
      const usable = config.useMockData ? profile : profile && token ? profile : null;

      bindClient(Boolean(token));
      if (usable) {
        identify(usable.id);
        track('session_restored');
      }
      setUser(usable);
      setStatus(usable ? 'signedIn' : 'signedOut');
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The API refused the refresh token (signed out elsewhere, offboarded,
   * revoked): drop to the sign-in screen rather than leave a catalog that
   * fails every request.
   */
  useEffect(
    () =>
      session.onSessionExpired(() => {
        track('session_expired');
        void store.signOut();
        bindClient(false);
        resetIdentity();
        setUser(null);
        setStatus('signedOut');
      }),
    [],
  );

  /**
   * Renew on the way back to the foreground, before the screens refetch.
   *
   * After a while in the background the access token has lapsed; renewing here,
   * once, means the screens' first requests already carry a valid token instead
   * of all failing with 401 together.
   */
  useEffect(() => {
    if (config.useMockData || status !== 'signedIn') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void session.freshAccessToken();
    });
    return () => subscription.remove();
  }, [status]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (config.useMockData) {
      const next = await store.signIn(email, password);
      identify(next.id);
      track('login', { mock: true });
      setUser(next);
      setStatus('signedIn');
      return;
    }

    let signedIn: Awaited<ReturnType<typeof apiSignIn>>;
    try {
      signedIn = await apiSignIn(email, password);
    } catch (error) {
      // The reason, never the address: "how many sign-ins fail, and why" is
      // the question, and a wrong password is not the same problem as an
      // unreachable server.
      track('login_failed', {
        reason: error instanceof AuthFailure ? error.code : 'unreachable_or_server',
      });
      throw error;
    }
    await session.saveSession(signedIn);
    await store.saveSession(signedIn.user);
    bindClient(true);
    /*
     * Fire-and-forget on purpose: registering is how the dashboard learns this
     * device exists, and it is not worth a single frame of the sign-in flow.
     * telemetry.ts swallows its own failures.
     */
    void registerDevice();
    // Only the id. Firebase retains user properties well past a session, and
    // an email address in one turns the analytics console into a copy of the
    // staff directory.
    identify(signedIn.user.id);
    track('login');
    setUser(signedIn.user);
    setStatus('signedIn');
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      if (!config.useMockData) {
        try {
          await apiRegister(input);
        } catch (error) {
          track('sign_up_failed', {
            reason: error instanceof AuthFailure ? error.code : 'unreachable_or_server',
          });
          throw error;
        }
        track('sign_up');
        // The API creates the account but hands back no tokens, so the
        // session comes from an ordinary sign-in with the same credentials.
        try {
          await signIn(input.email, input.password);
        } catch {
          // The account exists now, so pressing "Create account" again would
          // only answer "email already registered". Say what actually happened.
          throw new AuthMessageError(
            'Your account was created, but signing in failed. Sign in with the same email and password.',
          );
        }
        return;
      }

      let next: AuthUser;
      try {
        next = await store.register(input);
      } catch (error) {
        track('sign_up_failed', {
          reason: error instanceof AuthFailure ? error.code : 'unknown',
        });
        throw error;
      }
      identify(next.id);
      track('sign_up', { mock: true });
      setUser(next);
      setStatus('signedIn');
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    // First, while the access token still exists — clearPushToken reads it
    // synchronously. Not awaited: sign-out must not wait on the network.
    void clearPushToken();
    // Revoke server-side too, or the refresh token stays valid for 30 days.
    const refreshToken = session.currentRefreshToken();
    if (refreshToken) void apiLogout(refreshToken);
    await store.signOut();
    await session.clearSession();
    bindClient(false);
    // Before clearing state, so nothing after this is attributed to whoever
    // just left the device.
    track('sign_out');
    resetIdentity();
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Daily activity: a signed-in open, or a return to the foreground, is a
  // check-in. Sign-in itself registers, so the first of these is skipped.
  useEffect(() => {
    if (status !== 'signedIn') return;
    void checkIn();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkIn();
    });
    return () => subscription.remove();
  }, [status]);

  const updateUser = useCallback(async (next: AuthUser) => {
    await store.saveSession(next);
    setUser(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, register, signOut, updateUser }),
    [status, user, signIn, register, signOut, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
