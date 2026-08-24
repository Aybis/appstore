import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, ApiError } from '../api'
import { Failed, Loading } from '../ui/state'
import { colorFor, initialsFor } from './Catalog'

interface Totals {
  members: number
  devices: number
  activeUsers: number
  logins: number
  apps: number
  publishedApps: number
  installs: number
  failedInstalls: number
  releases: number
  testers: number
}

interface Dashboard {
  windowDays: number
  totals: Totals
  installsByApp: { slug: string; name: string; installs: number; failures: number; devices: number }[]
  versionsInUse: { slug: string; name: string; version: string; devices: number }[]
  ratings: { slug: string; name: string; average: number; count: number; good: number; bad: number }[]
  publishers: { publisher: string; releases: number; apps: number }[]
  empty: boolean
}

const WINDOWS = [7, 30, 90]

/** A bar sized against the largest value in its own list, not against 100. */
const Bar = ({ value, max, tone }: { value: number; max: number; tone?: 'bad' }) => (
  <span className="bar" aria-hidden="true">
    <span
      className={`bar-fill${tone === 'bad' ? ' bar-bad' : ''}`}
      style={{ width: `${max > 0 ? Math.max((value / max) * 100, 2) : 0}%` }}
    />
  </span>
)

export const DashboardPage = () => {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  const load = useCallback(() => {
    setError(null)
    api
      .get<Dashboard>(`/dashboard?days=${days}`)
      .then(setData)
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load the dashboard'),
      )
  }, [days])

  useEffect(load, [load])

  if (error) return <Failed error={error} onRetry={load} />
  if (!data) return <Loading label="Loading the dashboard…" />

  const { totals } = data
  const maxInstalls = Math.max(1, ...data.installsByApp.map((a) => a.installs))
  const maxVersion = Math.max(1, ...data.versionsInUse.map((v) => v.devices))

  return (
    <>
      <div className="page-head rise">
        <div>
          <h1>Dashboard</h1>
          <p>
            What this organization has been doing for the last {data.windowDays} days.
          </p>
        </div>
        <select
          className="filter-select"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          aria-label="Time window"
        >
          {WINDOWS.map((value) => (
            <option key={value} value={value}>
              Last {value} days
            </option>
          ))}
        </select>
      </div>

      {data.empty && (
        <p className="notice rise">
          No device has reported yet, so the install and version figures below
          are all zero — that is an absence of data, not a measurement. Run{' '}
          <code>seed:telemetry</code> to populate it with demo activity.
        </p>
      )}

      <div className="stat-grid rise" style={{ '--i': 1 } as React.CSSProperties}>
        <Stat n={totals.members} label="people" hint="with a role in this org" />
        <Stat n={totals.devices} label="devices" hint="have registered" />
        <Stat n={totals.activeUsers} label="signed in" hint={`in ${data.windowDays} days`} />
        <Stat n={totals.logins} label="sign-ins" hint="not sessions — see note" />
        <Stat n={totals.apps} label="apps" hint={`${totals.publishedApps} with a live build`} />
        <Stat n={totals.releases} label="releases" hint="uploaded in the window" />
        <Stat n={totals.installs} label="installs" hint="succeeded or updated" />
        <Stat
          n={totals.failedInstalls}
          label="failed"
          hint="installs that did not finish"
          tone={totals.failedInstalls > 0 ? 'bad' : undefined}
        />
      </div>

      <div className="panel-grid">
        <section className="section rise" style={{ '--i': 2 } as React.CSSProperties}>
          <h2>Installs by app</h2>
          {data.installsByApp.length === 0 ? (
            <p className="muted">Nothing installed in this window.</p>
          ) : (
            <ul className="rank">
              {data.installsByApp.map((app) => (
                <li key={app.slug}>
                  <Link to={`/apps/${app.slug}`} className="rank-name">
                    <span className="rank-icon" style={{ background: colorFor(app.slug) }}>
                      {initialsFor(app.name)}
                    </span>
                    {app.name}
                  </Link>
                  <Bar value={app.installs} max={maxInstalls} />
                  <span className="rank-n">
                    {app.installs}
                    {app.failures > 0 && <em className="rank-fail"> · {app.failures} failed</em>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section rise" style={{ '--i': 3 } as React.CSSProperties}>
          <h2>Versions in use</h2>
          <p className="section-sub">
            What each device is on now — not how many times a version was ever
            installed.
          </p>
          {data.versionsInUse.length === 0 ? (
            <p className="muted">No device has reported an install.</p>
          ) : (
            <ul className="rank">
              {data.versionsInUse.map((row) => (
                <li key={`${row.slug}-${row.version}`}>
                  <span className="rank-name">
                    {row.name} <code className="rank-version">v{row.version}</code>
                  </span>
                  <Bar value={row.devices} max={maxVersion} />
                  <span className="rank-n">{row.devices}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section rise" style={{ '--i': 4 } as React.CSSProperties}>
          <h2>Ratings</h2>
          {data.ratings.length === 0 ? (
            <p className="muted">
              Nothing rated yet. Rating is not built into the app — the table
              exists so this reads a real column when it is.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>App</th>
                    <th>Average</th>
                    <th>Good</th>
                    <th>Poor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ratings.map((row) => (
                    <tr key={row.slug}>
                      <td>{row.name}</td>
                      <td className="nums">
                        {row.average.toFixed(2)} <span className="muted">({row.count})</span>
                      </td>
                      <td className="nums">{row.good}</td>
                      <td className="nums">
                        {row.bad > 0 ? <strong className="rank-fail">{row.bad}</strong> : row.bad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section rise" style={{ '--i': 5 } as React.CSSProperties}>
          <h2>Who is publishing</h2>
          {data.publishers.length === 0 ? (
            <p className="muted">No releases in this window.</p>
          ) : (
            <ul className="rank">
              {data.publishers.map((row) => (
                <li key={row.publisher}>
                  <span className="rank-name">{row.publisher}</span>
                  <Bar
                    value={row.releases}
                    max={Math.max(1, ...data.publishers.map((p) => p.releases))}
                  />
                  <span className="rank-n">
                    {row.releases} <span className="muted">/ {row.apps} apps</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

const Stat = ({
  n,
  label,
  hint,
  tone,
}: {
  n: number
  label: string
  hint: string
  tone?: 'bad'
}) => (
  <div className={`stat${tone === 'bad' ? ' stat-warn' : ''}`}>
    <span className="stat-n">{n.toLocaleString()}</span>
    <span className="stat-label">{label}</span>
    <span className="stat-hint">{hint}</span>
  </div>
)
