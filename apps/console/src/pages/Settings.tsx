import { useEffect, useRef, useState, type FormEvent } from 'react'

import { api, ApiError, apiUrl, session } from '../services/api'
import { useAuth } from '../services/auth'
import { config } from '../config'
import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from '../utils/theme-preference'
import { prepareIcon } from '../utils/icon-image'
import type { Profile } from '../types'
import { Avatar, Button, Field, Message, PageHeader, useConfirm } from '../components'

/** Same rules the API enforces (@appstore/shared passwordSchema). */
const PASSWORD_RULES = [
  { label: '8+ characters', test: (value: string) => value.length >= 8 },
  { label: 'a letter', test: (value: string) => /[A-Za-z]/.test(value) },
  { label: 'a number', test: (value: string) => /[0-9]/.test(value) },
]

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
 * up with forty toggles nobody understands: your profile, your password, how
 * the console looks, and signing out everywhere.
 */
export const Settings = () => {
  const confirm = useConfirm()
  const { email, role, profile, setProfile, signOut } = useAuth()
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [revoked, setRevoked] = useState<number | null>(null)

  useEffect(() => {
    applyThemePreference(theme)
  }, [theme])

  // --- Profile -------------------------------------------------------------
  const [name, setName] = useState('')
  const [profileNote, setProfileNote] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) setName(profile.displayName)
  }, [profile])

  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    setProfileBusy(true)
    setProfileNote(null)
    try {
      setProfile(await api.patch<Profile>('/me', { displayName: name.trim() }))
      setProfileNote({ tone: 'success', text: 'Name saved.' })
    } catch (caught) {
      setProfileNote({ tone: 'error', text: errorText(caught, 'Could not save your name') })
    } finally {
      setProfileBusy(false)
    }
  }

  const uploadPhoto = async (file: File) => {
    setProfileBusy(true)
    setProfileNote(null)
    try {
      // Square and 512 px, the same treatment app icons get before upload.
      const prepared = await prepareIcon(file)
      const form = new FormData()
      form.append('avatar', prepared.file)
      setProfile(await api.upload<Profile>('/me/avatar', form))
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : 'Could not upload the photo'
      setProfileNote({ tone: 'error', text })
    } finally {
      setProfileBusy(false)
      if (photoInput.current) photoInput.current.value = ''
    }
  }

  const removePhoto = async () => {
    setProfileBusy(true)
    setProfileNote(null)
    try {
      setProfile(await api.del<Profile>('/me/avatar'))
    } catch (caught) {
      setProfileNote({ tone: 'error', text: errorText(caught, 'Could not remove the photo') })
    } finally {
      setProfileBusy(false)
    }
  }

  // --- Password ------------------------------------------------------------
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordFailure, setPasswordFailure] = useState<string | null>(null)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const nextOk = PASSWORD_RULES.every((rule) => rule.test(next))

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (next !== repeat) return setPasswordFailure('The new passwords do not match')
    setPasswordBusy(true)
    setPasswordFailure(null)
    try {
      await api.post('/me/password', { currentPassword: current, newPassword: next })
      // Every session just ended on the server, this one included.
      setPasswordChanged(true)
      session.clear()
      setTimeout(signOut, 1500)
    } catch (caught) {
      setPasswordFailure(errorText(caught, 'Could not change the password'))
      setPasswordBusy(false)
    }
  }

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
        <h2>Profile</h2>
        <p className="section-sub">How you appear in this console and in the MAYA app.</p>

        <div className="profile-photo">
          <Avatar url={apiUrl(profile?.avatarUrl ?? '')} name={profile?.displayName ?? email ?? ''} size={72} />
          <div className="row-actions">
            <input
              ref={photoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadPhoto(file)
              }}
            />
            <Button variant="ghost" size="sm" disabled={profileBusy} onClick={() => photoInput.current?.click()}>
              {profile?.avatarUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            {profile?.avatarUrl && (
              <Button variant="ghost" size="sm" disabled={profileBusy} onClick={() => void removePhoto()}>
                Remove
              </Button>
            )}
          </div>
        </div>

        <form className="inline-form" onSubmit={saveName}>
          <Field label="Name">
            <input
              required
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={profileBusy || !name.trim() || name.trim() === profile?.displayName}>
            Save
          </Button>
        </form>
        {profileNote && <Message tone={profileNote.tone}>{profileNote.text}</Message>}
      </section>

      <section className="section rise" style={{ '--i': 2 } as React.CSSProperties}>
        <h2>Password</h2>
        <p className="section-sub">
          Changing it signs you out on every device, this one included, so
          anyone who knew the old one loses access straight away.
        </p>

        {passwordChanged ? (
          <Message tone="success">Password changed. Signing you out…</Message>
        ) : (
          <form className="password-form" onSubmit={changePassword}>
            <Field label="Current password">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </Field>
            <ul className="password-rules">
              {PASSWORD_RULES.map((rule) => (
                <li key={rule.label} className={rule.test(next) ? 'met' : undefined}>
                  <span aria-hidden="true">{rule.test(next) ? '✓' : '○'}</span> {rule.label}
                </li>
              ))}
            </ul>
            <Field label="Repeat new password">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={passwordBusy || !current || !nextOk || !repeat}>
              {passwordBusy ? 'Changing…' : 'Change password'}
            </Button>
            {passwordFailure && <Message tone="error">{passwordFailure}</Message>}
          </form>
        )}
      </section>

      <section className="section rise" style={{ '--i': 3 } as React.CSSProperties}>
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

      <section className="section rise" style={{ '--i': 4 } as React.CSSProperties}>
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

      <section className="section rise" style={{ '--i': 5 } as React.CSSProperties}>
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
