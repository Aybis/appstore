// Must stay first — Sentry has to be running before anything else can throw.
import './instrument'

import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
// Tokens first, then the shared component vocabulary — buttons, cards, tables,
// states. Imported once here rather than per route: every route uses it, and
// relying on whichever route happened to import it first made the cascade
// depend on navigation order.
import './theme.css'
import './ui/ui.css'

// React 19 routes render errors through these hooks instead of window.onerror.
createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
