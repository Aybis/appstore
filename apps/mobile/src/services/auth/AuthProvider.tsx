import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { HttpAppProvider, MockAppProvider, setClient } from '../api';
import { bindTelemetryToken, clearPushToken, registerDevice } from '../device/telemetry';
import { identify, resetIdentity, track } from '../telemetry';
import { config } from '../api/config';
import * as store from '../storage/auth';
import { AuthFailure, type AuthUser } from '../storage/auth';
import { apiRefresh, apiSignIn } from './api-auth';

const TOKEN_KEY = 'maya.token.v1';
const REFRESH_KEY = 'maya.refresh.v1';

/**
 * Held outside React state so the provider's closures always read the latest
 * value: a token renewed mid-flight must be visible to the very next request,
 * not on the next render.
 */
let currentAccessToken: string | null = null;

/** Set by the provider; called when the server has ended the session. */
let onSessionExpired: (() => void) | null = null;

/**
 * Renews the access token in place. Null means no new token — and when the
 * refresh token is gone or refused, the person is signed out, since nothing
 * they do next can succeed.
 */
const renewAccessToken = async (): Promise<string | null> => {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    onSessionExpired?.();
    return null;
  }

  const next = await apiRefresh(refreshToken);
  if (next === 'spent') {
    onSessionExpired?.();
    return null;
  }
  if (!next) return null;

  currentAccessToken = next.accessToken;
  await AsyncStorage.setItem(TOKEN_KEY, next.accessToken);
  if (next.refreshToken) await AsyncStorage.setItem(REFRESH_KEY, next.refreshToken);
  return next.accessToken;
};

/**
 * fetch() against the API as the signed-in person: adds the token, and on a
 * 401 renews it once and retries. Throws when there is no session to use.
 */
export const authorizedFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const send = (token: string) =>
    fetch(`${config.apiBaseUrl}${config.apiPrefix}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
    });

  if (!currentAccessToken) throw new Error('Not signed in');
  const first = await send(currentAccessToken);
  if (first.status !== 401) return first;

  const renewed = await renewAccessToken();
  return renewed ? send(renewed) : first;
};

/**
 * Points the data layer at the API once a token exists, and back at the mock
 * provider on sign-out. Hooks resolve through getClient(), so no screen has to
 * know which provider is active.
 */
const bindClient = (token: string | null): void => {
  currentAccessToken = token;
  // Telemetry reads the same token, through the same accessor, so it can never
  // drift from what the data client is using.
  bindTelemetryToken(() => currentAccessToken);
  if (config.useMockData) return;
  setClient(
    token
      ? new HttpAppProvider(() => currentAccessToken, renewAccessToken)
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
      const [session, token] = await Promise.all([
        store.readSession(),
        AsyncStorage.getItem(TOKEN_KEY),
      ]);
      if (cancelled) return;

      // A session without a token is unusable against the API — treat it as
      // signed out rather than showing a catalog that will 401 on every read.
      const usable = config.useMockData ? session : session && token ? session : null;

      bindClient(token);
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

  const signIn = useCallback(async (email: string, password: string) => {
    if (config.useMockData) {
      const next = await store.signIn(email, password);
      identify(next.id);
      track('login', { mock: true });
      setUser(next);
      setStatus('signedIn');
      return;
    }

    let session: Awaited<ReturnType<typeof apiSignIn>>;
    try {
      session = await apiSignIn(email, password);
    } catch (error) {
      // The reason, never the address: "how many sign-ins fail, and why" is
      // the question, and a wrong password is not the same problem as an
      // unreachable server.
      track('login_failed', {
        reason: error instanceof AuthFailure ? error.code : 'unreachable_or_server',
      });
      throw error;
    }
    await AsyncStorage.setItem(TOKEN_KEY, session.accessToken);
    if (session.refreshToken) {
      await AsyncStorage.setItem(REFRESH_KEY, session.refreshToken);
    }
    await store.saveSession(session.user);
    bindClient(session.accessToken);
    /*
     * Fire-and-forget on purpose: registering is how the dashboard learns this
     * device exists, and it is not worth a single frame of the sign-in flow.
     * telemetry.ts swallows its own failures.
     */
    void registerDevice();
    // Only the id. Firebase retains user properties well past a session, and
    // an email address in one turns the analytics console into a copy of the
    // staff directory.
    identify(session.user.id);
    track('login');
    setUser(session.user);
    setStatus('signedIn');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
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
    track('sign_up');
    setUser(next);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    // First, while the access token still exists — clearPushToken reads it
    // synchronously. Not awaited: sign-out must not wait on the network.
    void clearPushToken();
    await store.signOut();
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    bindClient(null);
    // Before clearing state, so nothing after this is attributed to whoever
    // just left the device.
    track('sign_out');
    resetIdentity();
    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    onSessionExpired = () => void signOut();
    return () => {
      onSessionExpired = null;
    };
  }, [signOut]);

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
