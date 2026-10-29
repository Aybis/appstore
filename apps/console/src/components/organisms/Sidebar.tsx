import type { Ref } from 'react'
import { NavLink } from 'react-router-dom'

import { apiUrl } from '../../services/api'
import { isStaff } from '../../services/auth'
import type { MembershipRole, Profile } from '../../types'
import { Avatar } from '../atoms/Avatar'
import { Button } from '../atoms/Button'
import {
  AppsIcon,
  AuditIcon,
  CloseIcon,
  DashboardIcon,
  KeysIcon,
  PeopleIcon,
  SettingsIcon,
  TestingIcon,
} from '../atoms/icons'
import { MayaMark } from '../atoms/MayaMark'

interface SidebarProps {
  email: string | null
  role: MembershipRole | null
  /** Name and photo; the email stands in until it has loaded. */
  profile: Profile | null
  onClose: () => void
  onSignOut: () => void
  /** Focus lands here when the mobile drawer opens. */
  closeButtonRef?: Ref<HTMLButtonElement>
}

/** The console's left rail: brand, the sections this role may open, and who is signed in. */
export const Sidebar = ({ email, role, profile, onClose, onSignOut, closeButtonRef }: SidebarProps) => {
  const admin = role === 'admin' || role === 'owner'

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <MayaMark size={26} />
          <span className="brand-name">MAYA</span>
          <span className="shell-tag">console</span>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="drawer-close"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Console sections">
        {/* NavLink sets aria-current="page" on the active one, which is what
            a screen reader announces — the colour and the rail are for
            everyone else. */}
        {isStaff(role) && (
          <NavLink to="/dashboard">
            <DashboardIcon />
            <span>Dashboard</span>
          </NavLink>
        )}

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

        {/* Everyone, and last. It holds your own account and how this
            console looks to you — nothing here is privileged. */}
        <NavLink to="/settings" className="sidebar-nav-last">
          <SettingsIcon />
          <span>Settings</span>
        </NavLink>
      </nav>

      <div className="sidebar-me">
        <NavLink to="/settings" className="sidebar-identity" title={email ?? undefined}>
          <Avatar url={apiUrl(profile?.avatarUrl ?? '')} name={profile?.displayName ?? email ?? ''} size={36} />
          <span className="sidebar-who">
            <span className="sidebar-name">{profile?.displayName ?? email}</span>
            {role && <span className="role-pill">{role}</span>}
          </span>
        </NavLink>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </aside>
  )
}
