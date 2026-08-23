import { NavLink, Outlet } from 'react-router-dom'

import { isStaff, useAuth } from '../auth'
import { MayaMark } from '../ui/MayaMark'
import './shell.css'

/** Console chrome: brand, navigation, identity. */
export const Shell = () => {
  const { email, role, signOut } = useAuth()

  return (
    <div className="shell">
      <header className="shell-bar">
        <div className="brand">
          <MayaMark size={26} />
          <span className="brand-name">MAYA</span>
          <span className="shell-tag">console</span>
        </div>

        <nav className="shell-nav">
          <NavLink to="/apps">Apps</NavLink>
          {/* Audit is admin-only server-side; hiding it for everyone else keeps
              the UI honest rather than offering a link that 403s. */}
          {(role === 'admin' || role === 'owner') && (
            <>
              <NavLink to="/members">People</NavLink>
              <NavLink to="/audit">Audit</NavLink>
            </>
          )}
        </nav>

        <div className="shell-me">
          <span className="shell-email" title={email ?? undefined}>
            {email}
          </span>
          {role && <span className="role-pill">{role}</span>}
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="shell-main">
        {!isStaff(role) && (
          <p className="notice">
            You are signed in as a viewer. Uploading, promoting and managing
            testers need a publisher role.
          </p>
        )}
        <Outlet />
      </main>
    </div>
  )
}
