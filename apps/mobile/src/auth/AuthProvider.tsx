import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as store from '../storage/auth';
import type { AuthUser } from '../storage/auth';

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
      const session = await store.readSession();
      if (cancelled) return;
      setUser(session);
      setStatus(session ? 'signedIn' : 'signedOut');
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await store.signIn(email, password);
    setUser(next);
    setStatus('signedIn');
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await store.register(input);
    setUser(next);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await store.signOut();
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
