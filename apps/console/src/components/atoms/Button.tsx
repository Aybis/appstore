import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'

interface ButtonStyle {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  /** Full width of its container. */
  block?: boolean
}

/** The class list every button-looking thing shares, `<button>` or link. */
export const buttonClass = ({ variant = 'primary', size = 'md', block }: ButtonStyle, extra?: string): string =>
  ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', extra].filter(Boolean).join(' ')

type ButtonProps = ButtonStyle & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = ({ variant, size, block, className, type = 'button', ...rest }: ButtonProps) => (
  <button type={type} className={buttonClass({ variant, size, block }, className)} {...rest} />
)

/** A router link that looks like a button: navigation stays a real `<a>`. */
export const ButtonLink = ({ variant, size, block, className, ...rest }: ButtonStyle & LinkProps) => (
  <Link className={buttonClass({ variant, size, block }, className)} {...rest} />
)
