import { useCallback, useEffect, useState } from 'react'

import { api, ApiError } from '../api'
import { Empty, Failed, Loading } from '../ui/state'
import type { AuditEvent } from '../types'
import '../ui/ui.css'

const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Admin-only view of the append-only trail. */
export const Audit = () => {
  const [events, setEvents] = useState<AuditEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit</h1>
          <p>
            Every privileged action, newest first. The log is append-only at the
            database level — nothing here can be edited or removed.
          </p>
        </div>
      </div>

      {error && <Failed error={error} onRetry={load} />}
      {!error && !events && <Loading label="Loading the trail…" />}
      {!error && events?.length === 0 && (
        <Empty title="Nothing recorded yet" body="Publishing or promoting a build writes here." />
      )}

      {events && events.length > 0 && (
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
              {events.map((event) => (
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
