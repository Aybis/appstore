import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, registerAccount } from '../api'
import { config } from '../config'
import { MayaMark } from '../ui/MayaMark'
import './login.css'

export const Register = () => {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

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
      setDone(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the account')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="login-page">
        <div className="login-card">
          <MayaMark size={44} />
          <h1>You&rsquo;re registered</h1>
          <p className="login-sub">
            Open the MAYA app and sign in with <strong>{email}</strong>. An
            administrator chooses which apps appear for you, so your list may be
            empty at first.
          </p>
          <Link className="btn btn-primary login-submit" to="/">
            Get the app
          </Link>
        </div>
      </div>
    )
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
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 12 characters"
          />
        </label>

        <p className="login-note">
          An administrator chooses which apps appear for you, so your list may be
          empty until they have set you up.
        </p>

        <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="login-alt">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
