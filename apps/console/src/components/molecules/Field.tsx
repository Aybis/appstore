import type { CSSProperties, ReactNode } from 'react'

interface FieldProps {
  label: ReactNode
  /** One line under the control, explaining what the value is for. */
  hint?: ReactNode
  /** The control: an input, select, textarea, or a group holding one. */
  children: ReactNode
  style?: CSSProperties
}

/**
 * A labelled form control. The `<label>` wraps the control, so clicking the
 * label focuses it without an id to keep in sync.
 */
export const Field = ({ label, hint, children, style }: FieldProps) => (
  <label className="field" style={style}>
    <span>{label}</span>
    {children}
    {hint && <small className="field-hint">{hint}</small>}
  </label>
)
