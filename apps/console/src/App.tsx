import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider, useAuth } from './auth'
import { Landing } from './routes/Landing'
import { Login } from './routes/Login'
import { Shell } from './routes/Shell'
import { Catalog } from './routes/Catalog'
import { AppDetail } from './routes/AppDetail'
import { Audit } from './routes/Audit'
import { ApiKeys } from './routes/ApiKeys'
import { Members } from './routes/Members'
import { Testing } from './routes/Testing'
import { PublicApp } from './routes/PublicApp'

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
          element={
            <Private>
              <Shell />
            </Private>
          }
        >
          <Route path="/apps" element={<Catalog />} />
          <Route path="/apps/:slug" element={<AppDetail />} />
          <Route path="/testing" element={<Testing />} />
          <Route path="/members" element={<Members />} />
          <Route path="/api-keys" element={<ApiKeys />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
        {/* An unknown path is far more likely to be a stale deep link than a
            typo, so it lands on the page that explains what MAYA is. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)
