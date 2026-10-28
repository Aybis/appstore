import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, registerAccount } from '../api'
import { useAuth } from '../auth'
import { config } from '../config'
import { MayaMark } from '../ui/MayaMark'
import './login.css'

/**
 * Mirrors `passwordSchema` in @appstore/shared. The server is the authority;
 * this only lets someone see they are done before they press the button.
 */
const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'A letter', test: (value) => /[A-Za-z]/.test(value) },
  { label: 'A number', test: (value) => /[0-9]/.test(value) },
]

export const Register = () => {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordOk = PASSWORD_RULES.every((rule) => rule.test(password))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await registerAccount({
        orgSlug: config.orgSlug,
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account')
      setBusy(false)
      return
    }
    // Signed straight in: asking someone to type the password they just chose
    // a second time is friction with no security gain.
    try {
      await signIn(email.trim(), password)
      navigate('/apps', { replace: true })
    } catch {
      // The account exists either way; fall back to the sign-in page.
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <MayaMark size={44} />
        <h1>Create your MAYA account</h1>
        <p className="login-sub">Register with your work email to use the MAYA app.</p>

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>Full name</span>
          <input
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8+ characters, a letter and a number"
              aria-describedby="password-rules"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <ul className="password-rules" id="password-rules">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password)
            return (
              <li key={rule.label} className={met ? 'met' : undefined}>
                <span aria-hidden="true">{met ? '✓' : '○'}</span> {rule.label}
              </li>
            )
          })}
        </ul>

        <p className="login-note">
          An administrator chooses which apps appear for you, so your list may be
          empty until they have set you up.
        </p>

        <button className="btn btn-primary login-submit" type="submit" disabled={busy || !passwordOk}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="login-alt">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
