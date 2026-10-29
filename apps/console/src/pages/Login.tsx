import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../services/auth'
import { ApiError } from '../services/api'
import { AuthTemplate, Button, Field } from '../components'

export const Login = () => {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate('/apps', { replace: true })
    } catch (caught) {
      // The API returns the same message for "no such user" and "wrong
      // password" on purpose; surfacing it verbatim keeps that property.
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthTemplate
      title="Sign in to MAYA"
      subtitle="Use your company account to reach the console."
      error={error}
      onSubmit={submit}
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <Field label="Email">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
        />
      </Field>

      <Button variant="primary" className="login-submit" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </AuthTemplate>
  )
}
