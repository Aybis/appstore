import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { isStaff, useAuth } from '../auth'
import { MayaMark } from '../ui/MayaMark'
import {
  AppsIcon,
  AuditIcon,
  CloseIcon,
  KeysIcon,
  MenuIcon,
  PeopleIcon,
  TestingIcon,
} from '../ui/NavIcons'
import './shell.css'

/**
 * Console chrome: a persistent left rail, content beside it.
 *
 * This was a horizontal top bar, which is the layout that stops working the
 * moment a CMS has more than about five destinations — links compete with the
 * brand and the identity for one row, and every new section makes the row
 * worse. A rail grows downwards, which is free.
 *
 * The sidebar lives OUTSIDE the <Outlet>, so react-router does not remount it
 * on navigation. That matters beyond render cost: `.rise` entrance animations
 * are keyed to mount, so a sidebar inside the outlet would re-animate itself
 * on every single page change — the nav would flicker each time you used it.
 */
export const Shell = () => {
  const { email, role, signOut } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setDrawerOpen(false), [])

  // Navigating is the most common way to finish with the drawer, and leaving
  // it open over the page you just asked for is the classic mobile-nav bug.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)

    // Focus moves into the drawer, and back to the button that opened it —
    // otherwise a keyboard user closes the drawer and lands at the top of the
    // document with no idea where they are.
    closeButton.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      menuButton.current?.focus()
    }
  }, [drawerOpen, close])

  const admin = role === 'admin' || role === 'owner'

  return (
    <div className={`shell${drawerOpen ? ' shell-drawer-open' : ''}`}>
      {/* First focusable thing on the page. Without it a keyboard user tabs
          through every navigation item before reaching the content, on every
          page, forever. */}
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar" id="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <MayaMark size={26} />
            <span className="brand-name">MAYA</span>
            <span className="shell-tag">console</span>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="drawer-close"
            onClick={close}
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Console sections">
          {/* NavLink sets aria-current="page" on the active one, which is what
              a screen reader announces — the colour and the rail are for
              everyone else. */}
          <NavLink to="/apps">
            <AppsIcon />
            <span>Apps</span>
          </NavLink>

          {/* Publisher and above — enrolling a tester is the same authority as
              publishing, so this is not gated to admins the way People is. */}
          {isStaff(role) && (
            <NavLink to="/testing">
              <TestingIcon />
              <span>Testing</span>
            </NavLink>
          )}

          {/* Admin-only server-side; hiding them keeps the UI honest rather
              than offering links that 403. */}
          {admin && (
            <>
              <NavLink to="/members">
                <PeopleIcon />
                <span>People</span>
              </NavLink>
              <NavLink to="/api-keys">
                <KeysIcon />
                <span>Keys</span>
              </NavLink>
              <NavLink to="/audit">
                <AuditIcon />
                <span>Audit</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-me">
          <div className="sidebar-identity">
            <span className="sidebar-email" title={email ?? undefined}>
              {email}
            </span>
            {role && <span className="role-pill">{role}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Only ever visible while the drawer is open; clicking it is the other
          way people expect to dismiss one. */}
      <button
        type="button"
        className="drawer-scrim"
        onClick={close}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="shell-body">
        {/* Mobile only. On a desktop the sidebar already carries the brand, so
            a second copy would be chrome for its own sake. */}
        <header className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="drawer-open"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="sidebar"
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
          <div className="brand">
            <MayaMark size={22} />
            <span className="brand-name">MAYA</span>
          </div>
        </header>

        <main className="shell-main" id="main">
          {!isStaff(role) && (
            <p className="notice">
              You are signed in as a viewer. Uploading, promoting and managing
              testers need a publisher role.
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
