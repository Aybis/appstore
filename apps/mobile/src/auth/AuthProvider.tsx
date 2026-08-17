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
import { config } from '../api/config';
import * as store from '../storage/auth';
import type { AuthUser } from '../storage/auth';
import { apiRefresh, apiSignIn } from './api-auth';

const TOKEN_KEY = 'maya.token.v1';
const REFRESH_KEY = 'maya.refresh.v1';

/**
 * Held outside React state so the provider's closures always read the latest
 * value: a token renewed mid-flight must be visible to the very next request,
 * not on the next render.
 */
let currentAccessToken: string | null = null;

/** Renews the access token in place; null means the refresh token is spent. */
const renewAccessToken = async (): Promise<string | null> => {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const next = await apiRefresh(refreshToken);
  if (!next) return null;

  currentAccessToken = next.accessToken;
  await AsyncStorage.setItem(TOKEN_KEY, next.accessToken);
  if (next.refreshToken) await AsyncStorage.setItem(REFRESH_KEY, next.refreshToken);
  return next.accessToken;
};

/**
 * Points the data layer at the API once a token exists, and back at the mock
 * provider on sign-out. Hooks resolve through getClient(), so no screen has to
 * know which provider is active.
 */
const bindClient = (token: string | null): void => {
  currentAccessToken = token;
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
      setUser(next);
      setStatus('signedIn');
      return;
    }

    const session = await apiSignIn(email, password);
    await AsyncStorage.setItem(TOKEN_KEY, session.accessToken);
    if (session.refreshToken) {
      await AsyncStorage.setItem(REFRESH_KEY, session.refreshToken);
    }
    await store.saveSession(session.user);
    bindClient(session.accessToken);
    setUser(session.user);
    setStatus('signedIn');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await store.register(input);
    setUser(next);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await store.signOut();
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    bindClient(null);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, register, signOut }),
    [status, user, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
