import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = 'maya.users.v1';
const SESSION_KEY = 'maya.session.v1';

/**
 * Local-only account store standing in for the API's auth endpoints.
 *
 * ⚠️  Passwords are kept in plain text in AsyncStorage. That is acceptable
 * *only* because these are dummy accounts on a device with no real data behind
 * them. When the NestJS auth lands (argon2 + org-scoped JWT, see apps/api),
 * this whole module is replaced by token storage — nothing above it needs to
 * change, because screens only ever touch AuthProvider.
 */

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: string;
};

/** The signed-in user as the UI sees it — never carries the password. */
export type AuthUser = Omit<StoredUser, 'password'>;

export type AuthError =
  | 'invalid-credentials'
  | 'email-taken'
  | 'invalid-email'
  | 'weak-password'
  | 'missing-name';

export class AuthFailure extends Error {
  constructor(readonly code: AuthError) {
    super(code);
    this.name = 'AuthFailure';
  }
}

export const DEMO_EMAIL = 'demo@maya.app';
export const DEMO_PASSWORD = 'demo1234';

const DEMO_USER: StoredUser = {
  id: 'user-demo',
  name: 'Demo Employee',
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toAuthUser = ({ password: _password, ...rest }: StoredUser): AuthUser =>
  rest;

const readUsers = async (): Promise<StoredUser[]> => {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
};

const writeUsers = (users: StoredUser[]): Promise<void> =>
  AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

/** Ensures the demo account exists so a fresh install can sign in immediately. */
export const seedDemoUser = async (): Promise<void> => {
  const users = await readUsers();
  if (users.some((user) => user.email === DEMO_EMAIL)) return;
  await writeUsers([DEMO_USER, ...users]);
};

export const signIn = async (
  email: string,
  password: string,
): Promise<AuthUser> => {
  await seedDemoUser();

  const users = await readUsers();
  const match = users.find(
    (user) => user.email === normalizeEmail(email) && user.password === password,
  );

  if (!match) throw new AuthFailure('invalid-credentials');

  const user = toAuthUser(match);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

export const register = async (input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthUser> => {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) throw new AuthFailure('missing-name');
  if (!EMAIL_PATTERN.test(email)) throw new AuthFailure('invalid-email');
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthFailure('weak-password');
  }

  await seedDemoUser();
  const users = await readUsers();
  if (users.some((user) => user.email === email)) {
    throw new AuthFailure('email-taken');
  }

  const created: StoredUser = {
    id: `user-${Date.now()}`,
    name,
    email,
    password: input.password,
    createdAt: new Date().toISOString(),
  };

  await writeUsers([...users, created]);

  const user = toAuthUser(created);
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
};

export const readSession = async (): Promise<AuthUser | null> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const signOut = (): Promise<void> => AsyncStorage.removeItem(SESSION_KEY);

/** Human-readable copy for each failure code. */
export const authErrorMessage = (error: unknown): string => {
  if (error instanceof AuthFailure) {
    switch (error.code) {
      case 'invalid-credentials':
        return 'That email and password combination did not match an account.';
      case 'email-taken':
        return 'An account already exists for that email.';
      case 'invalid-email':
        return 'Enter a valid email address.';
      case 'weak-password':
        return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      case 'missing-name':
        return 'Enter your name.';
    }
  }
  return 'Something went wrong. Try again.';
};
