import { useEffect, useMemo, useState } from 'react'

import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Failed, Loading } from '../ui/state'
import type { MembershipRole } from '../types'

interface Member {
  userId: string
  email: string
  displayName: string
  role: MembershipRole
  joinedAt: string
  /** Slugs of apps this person is enrolled to test. */
  testing: string[]
}

const ROLES: MembershipRole[] = ['owner', 'admin', 'publisher', 'viewer']

/**
 * Plain-language names for the roles.
 *
 * The database calls the baseline role `viewer`, which describes what it can do
 * to the console rather than who the person is. Most people holding it are
 * simply staff who install apps, so the console says "Employee" and the API
 * keeps its own vocabulary — renaming the enum would rewrite history in the
 * audit log for no gain.
 */
const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  publisher: 'Publisher',
  viewer: 'Employee',
}

const ROLE_HELP: Record<MembershipRole, string> = {
  owner: 'Full control, including billing and removing admins.',
  admin: 'Manages people and reads the audit log.',
  publisher: 'Uploads builds, promotes releases, manages testers.',
  viewer: 'Installs apps they are entitled to. No console powers.',
}

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

export const Members = () => {
  const { role: myRole } = useAuth()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | MembershipRole>('all')

  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<MembershipRole>('viewer')
  const [addError, setAddError] = useState<string | null>(null)

  const load = () => {
    api
      .get<Member[]>('/members')
      .then(setMembers)
      .catch((caught: unknown) => setFailure(errorText(caught, 'Could not load members')))
  }

  useEffect(load, [])

  const changeRole = async (member: Member, role: MembershipRole) => {
    setBusy(member.userId)
    setFailure(null)
    try {
      const updated = await api.patch<Member>(`/members/${member.userId}`, { role })
      setMembers((current) =>
        (current ?? []).map((entry) => (entry.userId === updated.userId ? updated : entry)),
      )
    } catch (caught) {
      // The server refuses to demote the last owner, and that message explains
      // why better than anything this page could invent.
      setFailure(errorText(caught, 'Could not change that role'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (member: Member) => {
    if (!confirm(`Remove ${member.email}? They are signed out everywhere immediately.`)) {
      return
    }
    setBusy(member.userId)
    setFailure(null)
    try {
      await api.del(`/members/${member.userId}`)
      setMembers((current) => (current ?? []).filter((entry) => entry.userId !== member.userId))
    } catch (caught) {
      setFailure(errorText(caught, 'Could not remove that member'))
    } finally {
      setBusy(null)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    setAddError(null)
    try {
      const added = await api.post<Member>('/members', { email, role: newRole })
      setMembers((current) => [...(current ?? []), added])
      setEmail('')
    } catch (caught) {
      setAddError(errorText(caught, 'Could not add that person'))
    }
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (members ?? []).filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false
      if (!needle) return true
      return (
        member.displayName.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle)
      )
    })
  }, [members, query, roleFilter])

  if (failure && !members) return <Failed error={failure} onRetry={load} />
  if (!members) return <Loading label="Loading members" />

  const canAdminister = myRole === 'admin' || myRole === 'owner'

  return (
    <>
      {/* A page-head with an h1, like every other route. The sidebar names
          this section "People"; a page that never says so leaves a screen
          reader user with no heading to confirm they arrived. */}
      <div className="page-head rise">
        <div>
          <h1>People</h1>
          <p>
            Who belongs to this organization and what they can do. Testing is
            separate — it is granted per app, so being a tester for one does not
            reveal another&rsquo;s unreleased builds.
          </p>
        </div>
      </div>

      <section className="section rise" style={{ '--i': 1 } as React.CSSProperties}>

        {failure && <p className="err-msg">{failure}</p>}

        <div className="filters">
          <input
            className="filter-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or email"
            aria-label="Search people"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
            aria-label="Filter by role"
          >
            <option value="all">Any role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
          <span className="filter-count">
            {shown.length === members.length
              ? `${members.length} people`
              : `${shown.length} of ${members.length}`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Testing</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((member) => (
                <tr key={member.userId}>
                  <td>
                    <div className="member-name">{member.displayName}</div>
                    <div className="member-email">{member.email}</div>
                  </td>
                  <td>
                    <select
                      className="role-select"
                      value={member.role}
                      disabled={!canAdminister || busy === member.userId}
                      onChange={(event) =>
                        void changeRole(member, event.target.value as MembershipRole)
                      }
                      title={ROLE_HELP[member.role]}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {member.testing.length === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <span className="tester-apps">{member.testing.join(', ')}</span>
                    )}
                  </td>
                  <td className="nums">
                    {new Date(member.joinedAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="row-actions">
                    {canAdminister && (
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy === member.userId}
                        onClick={() => void remove(member)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canAdminister && (
        <section className="section rise" style={{ '--i': 2 } as React.CSSProperties}>
          <h2>Add someone</h2>
          <p className="section-sub">
            They need an account already. MAYA does not create passwords for
            other people — the person signs up, then you grant them a role here.
          </p>
          <form className="inline-form" onSubmit={(event) => void add(event)}>
            <div className="field">
              <label htmlFor="member-email">Work email</label>
              <input
                id="member-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@company.com"
              />
            </div>
            <div className="field">
              <label htmlFor="member-role">Role</label>
              <select
                id="member-role"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as MembershipRole)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              Add
            </button>
          </form>
          {addError && <p className="err-msg">{addError}</p>}
          <p className="role-legend">
            {ROLES.map((role) => (
              <span key={role}>
                <strong>{ROLE_LABEL[role]}</strong> — {ROLE_HELP[role]}
              </span>
            ))}
          </p>
        </section>
      )}
    </>
  )
}
