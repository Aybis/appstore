import type { FormEvent, ReactNode } from 'react'

import { MayaMark } from '../atoms/MayaMark'
import './auth.css'

interface AuthTemplateProps {
  title: string
  subtitle: string
  /** Shown above the fields, announced to screen readers when it appears. */
  error?: string | null
  onSubmit: (event: FormEvent) => void
  /** The fields and the submit button. */
  children: ReactNode
  /** Under the form: the link to the other auth page. */
  footer?: ReactNode
}

/** A centred card holding one form — sign in and register. */
export const AuthTemplate = ({ title, subtitle, error, onSubmit, children, footer }: AuthTemplateProps) => (
  <div className="login-page">
    <form className="login-card" onSubmit={onSubmit}>
      <MayaMark size={44} />
      <h1>{title}</h1>
      <p className="login-sub">{subtitle}</p>

      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}

      {children}

      {footer && <p className="login-alt">{footer}</p>}
    </form>
  </div>
)
