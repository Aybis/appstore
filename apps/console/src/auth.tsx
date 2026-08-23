import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { api, logout, refresh, session } from './api'
import { config } from './config'
import type { AuthResponse, MembershipRole } from './types'

type Status = 'loading' | 'signedIn' | 'signedOut'

interface AuthValue {
  status: Status
  email: string | null
  role: MembershipRole | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

/** Claims off the access token. Identity only — authority is re-read server-side. */
const claims = (token: string): { sub: string; role: MembershipRole } | null => {
  try {
    return JSON.parse(atob(token.split('.')[1] ?? '')) as { sub: string; role: MembershipRole }
  } catch {
    return null
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<Status>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<MembershipRole | null>(null)

  // A reload keeps the tab's refresh token, so try to resume before deciding
  // the user is signed out — otherwise every refresh bounces them to /login.
  useEffect(() => {
    void refresh().then((ok) => {
      if (ok && session.access) {
        setRole(claims(session.access)?.role ?? null)
        setEmail(sessionStorage.getItem('maya.console.email'))
      }
      setStatus(ok ? 'signedIn' : 'signedOut')
    })
  }, [])

  const signIn = useCallback(async (address: string, password: string) => {
    const result = await api.post<AuthResponse>('/auth/login', {
      orgSlug: config.orgSlug,
      email: address,
      password,
    })
    session.set(result)
    sessionStorage.setItem('maya.console.email', address)
    setEmail(address)
    setRole(claims(result.accessToken)?.role ?? null)
    setStatus('signedIn')
  }, [])

  const signOut = useCallback(() => {
    // Fire-and-forget: the UI signs out immediately, and the server-side
    // revocation follows. Waiting on the network to log somebody out is the
    // wrong trade — but skipping the call entirely would leave the refresh
    // token live for 30 days.
    void logout()
    sessionStorage.removeItem('maya.console.email')
    setEmail(null)
    setRole(null)
    setStatus('signedOut')
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ status, email, role, signIn, signOut }),
    [status, email, role, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Roles allowed to publish, promote and manage testers. */
export const isStaff = (role: MembershipRole | null): boolean =>
  role === 'publisher' || role === 'admin' || role === 'owner'
