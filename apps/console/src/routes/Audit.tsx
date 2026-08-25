import { useCallback, useEffect, useMemo, useState } from 'react'

import { api, ApiError } from '../api'
import { Empty, Failed, Loading } from '../ui/state'
import type { AuditEvent } from '../types'

const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Admin-only view of the append-only trail. */
export const Audit = () => {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')

  const load = useCallback(() => {
    setError(null)
    api
      .get<AuditEvent[]>('/audit?limit=200')
      .then(setEvents)
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load the audit trail'),
      )
  }, [])

  useEffect(load, [load])

  /*
   * Action families rather than every distinct action. A log with fifteen
   * entries in the filter is a filter nobody opens twice — "release" is the
   * question people ask, not "release.promoted" specifically.
   */
  const families = useMemo(
    () => [...new Set((events ?? []).map((e) => e.action.split('.')[0] ?? e.action))].sort(),
    [events],
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (events ?? []).filter((event) => {
      if (action !== 'all' && !event.action.startsWith(`${action}.`)) return false
      if (!needle) return true
      return (
        event.action.toLowerCase().includes(needle) ||
        event.subjectId.toLowerCase().includes(needle) ||
        JSON.stringify(event.metadata ?? {}).toLowerCase().includes(needle)
      )
    })
  }, [events, query, action])

  return (
    <>
      <div className="page-head rise">
        <div>
          <h1>Audit</h1>
          <p>
            Every privileged action, newest first. The log is append-only at the
            database level — nothing here can be edited or removed.
          </p>
        </div>
      </div>

      {events && events.length > 0 && (
        <div className="filters rise" style={{ '--i': 1 } as React.CSSProperties}>
          <input
            className="filter-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search action, subject or detail"
            aria-label="Search the trail"
          />
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            aria-label="Filter by action"
          >
            <option value="all">Everything</option>
            {families.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
          <span className="filter-count">
            {shown.length === events.length
              ? `${events.length} events`
              : `${shown.length} of ${events.length}`}
          </span>
        </div>
      )}

      {error && <Failed error={error} onRetry={load} />}
      {!error && !events && <Loading label="Loading the trail…" />}
      {!error && events?.length === 0 && (
        <Empty title="Nothing recorded yet" body="Publishing or promoting a build writes here." />
      )}

      {events && events.length > 0 && shown.length === 0 && (
        <Empty title="Nothing matches" body="No recorded action matches those filters." />
      )}

      {shown.length > 0 && (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Subject</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((event) => (
                <tr key={event.id}>
                  <td className="mono">{when(event.createdAt)}</td>
                  <td className="mono">{event.action}</td>
                  <td>
                    <span className="mono">{event.subjectType}</span>{' '}
                    <span className="muted">{event.subjectId}</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--text-3)' }}>
                    {Object.entries(event.metadata ?? {})
                      .map(([key, value]) => `${key}=${String(value)}`)
                      .join(' ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
