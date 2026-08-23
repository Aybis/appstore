import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
// Tokens first, then the shared component vocabulary — buttons, cards, tables,
// states. Imported once here rather than per route: every route uses it, and
// relying on whichever route happened to import it first made the cascade
// depend on navigation order.
import './theme.css'
import './ui/ui.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
