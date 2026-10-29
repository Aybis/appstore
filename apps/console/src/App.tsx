import { withSentryReactRouterV7Routing } from '@sentry/react'
import { BrowserRouter, Navigate, Route, Routes as RouterRoutes } from 'react-router-dom'

import { AuthProvider, useAuth } from './services/auth'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { ConfirmProvider, ShellTemplate } from './components'
import { Catalog } from './pages/Catalog'
import { AppDetail } from './pages/AppDetail'
import { Audit } from './pages/Audit'
import { DashboardPage } from './pages/Dashboard'
import { ApiKeys } from './pages/ApiKeys'
import { Members } from './pages/Members'
import { NewApp } from './pages/NewApp'
import { Settings } from './pages/Settings'
import { Testing } from './pages/Testing'
import { PublicApp } from './pages/PublicApp'

// Reports each navigation as a transaction named by its route pattern.
const Routes = withSentryReactRouterV7Routing(RouterRoutes)

/**
 * Everything under here needs a session. Rendered as a gate rather than a
 * redirect inside each page, so a signed-out user never briefly sees console
 * chrome before being bounced.
 */
const Private = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth()
  if (status === 'loading') return <div className="boot">Loading…</div>
  if (status === 'signedOut') return <Navigate to="/login" replace />
  return <>{children}</>
}

const Public = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth()
  if (status === 'signedIn') return <Navigate to="/apps" replace />
  return <>{children}</>
}

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ConfirmProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* Public, and the target an https App Link resolves to when MAYA is
              not installed. Not behind Private: somebody following an install
              link has, by definition, not signed in here yet. */}
          <Route path="/app/:slug" element={<PublicApp />} />
          <Route
            path="/login"
            element={
              <Public>
                <Login />
              </Public>
            }
          />
          <Route
            path="/register"
            element={
              <Public>
                <Register />
              </Public>
            }
          />
          <Route
            element={
              <Private>
                <ShellTemplate />
              </Private>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/apps" element={<Catalog />} />
            {/* Before /apps/:slug, or "new" is read as a slug. */}
            <Route path="/apps/new" element={<NewApp />} />
            <Route path="/apps/:slug" element={<AppDetail />} />
            <Route path="/testing" element={<Testing />} />
            <Route path="/members" element={<Members />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          {/* An unknown path is far more likely to be a stale deep link than a
              typo, so it lands on the page that explains what MAYA is. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ConfirmProvider>
    </AuthProvider>
  </BrowserRouter>
)
