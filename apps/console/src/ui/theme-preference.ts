/**
 * Which theme the console shows, and where that choice lives.
 *
 * theme.css has supported `data-theme="light"` and `data-theme="dark"` on the
 * root element since it was written — every dark rule is guarded
 * `:root:not([data-theme="light"])` so an explicit choice beats the OS. What
 * was missing is anything that ever SET the attribute, so the console has only
 * ever followed the system.
 *
 * Three states, not two. "System" is a real choice and the correct default —
 * a person who has already told their OS they want dark at night should not
 * have to tell every application separately.
 */
export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'maya.console.theme'

export const readThemePreference = (): ThemePreference => {
  const stored = localStorage.getItem(KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/**
 * Applies a preference by stamping (or clearing) the root attribute.
 *
 * "System" REMOVES the attribute rather than setting it to anything. There is
 * no `data-theme="system"` in the stylesheet, and stamping one would leave the
 * dark rules matching `:not([data-theme="light"])` forever — which happens to
 * look right in dark and silently breaks light.
 */
export const applyThemePreference = (preference: ThemePreference): void => {
  if (preference === 'system') {
    document.documentElement.removeAttribute('data-theme')
    localStorage.removeItem(KEY)
    return
  }
  document.documentElement.setAttribute('data-theme', preference)
  localStorage.setItem(KEY, preference)
}
