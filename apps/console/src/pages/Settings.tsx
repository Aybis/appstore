import { useEffect, useState } from 'react'

import { api, ApiError, session } from '../services/api'
import { useAuth } from '../services/auth'
import { config } from '../config'
import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from '../utils/theme-preference'
import { Button, Message, PageHeader, useConfirm } from '../components'

const THEMES: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Follow what this device is set to' },
  { value: 'light', label: 'Light', hint: 'Always light, whatever the device says' },
  { value: 'dark', label: 'Dark', hint: 'Always dark, whatever the device says' },
]

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

/**
 * Settings.
 *
 * Deliberately short. A settings page collects the things that are genuinely
 * a person's own choice, and inventing switches to fill it out is how one ends
 * up with forty toggles nobody understands. There are three things here
 * because there are three things.
 */
export const Settings = () => {
  const confirm = useConfirm()
  const { email, role, signOut } = useAuth()
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [revoked, setRevoked] = useState<number | null>(null)

  useEffect(() => {
    applyThemePreference(theme)
  }, [theme])

  const signOutEverywhere = async () => {
    const sure = await confirm({
      title: 'Sign out everywhere?',
      body: 'Every device is signed out, including this one. Anything holding a stolen token loses it immediately.',
      confirmLabel: 'Sign out everywhere',
      tone: 'danger',
    })
    if (!sure) return
    setBusy(true)
    setFailure(null)
    try {
      const result = await api.post<{ revoked: number }>('/auth/logout-all', {})
      setRevoked(result.revoked)
      // The session just revoked includes this one, so staying on the page
      // would leave a console that looks signed in and can do nothing.
      session.clear()
      setTimeout(signOut, 1200)
    } catch (caught) {
      setFailure(errorText(caught, 'Could not sign out everywhere'))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account and how this console looks on this device."
      />

      <section className="section rise" style={{ '--i': 1 } as React.CSSProperties}>
        <h2>Appearance</h2>
        <p className="section-sub">
          Stored on this device only — it is a preference, not part of your
          account, so a different computer can be set differently.
        </p>

        <div className="choice-row" role="radiogroup" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className={`choice${theme === option.value ? ' choice-on' : ''}`}
              onClick={() => setTheme(option.value)}
            >
              <span className="choice-label">{option.label}</span>
              <span className="choice-hint">{option.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section rise" style={{ '--i': 2 } as React.CSSProperties}>
        <h2>Your account</h2>
        <div className="table-wrap">
          <table className="data">
            <tbody>
              <tr>
                <th scope="row">Signed in as</th>
                <td>{email}</td>
              </tr>
              <tr>
                <th scope="row">Role</th>
                <td>{role ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">Organization</th>
                <td className="mono">{config.orgSlug}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2>Security</h2>
        <p className="section-sub">
          Signing out here ends the session on this device. If you think
          somebody else has a token of yours, that is not enough — the ordinary
          sign-out retires the credential you are holding and leaves theirs
          working.
        </p>

        {revoked !== null ? (
          <Message tone="success">
            Ended {revoked} session{revoked === 1 ? '' : 's'}. Signing you out…
          </Message>
        ) : (
          <Button variant="ghost"
            disabled={busy}
            onClick={() => void signOutEverywhere()}
          >
            {busy ? 'Signing out…' : 'Sign out everywhere'}
          </Button>
        )}
        {failure && <Message tone="error">{failure}</Message>}
      </section>
    </>
  )
}
