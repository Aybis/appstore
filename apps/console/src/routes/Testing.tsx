import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TRACK_LABELS } from '@appstore/shared/tracks'

import { api, ApiError } from '../api'
import { Failed, Loading } from '../ui/state'
import type { ReleaseTrack, Tester } from '../types'

interface StageRelease {
  version: string
  status: string
  updatedAt: string
}

interface TestingApp {
  slug: string
  name: string
  platform: string
  testers: Tester[]
  stages: Partial<Record<ReleaseTrack, StageRelease>>
}

/** Stages a tester can be given sight of. Production is everyone, so it is not
 *  something you enrol into. */
const TESTABLE: ReleaseTrack[] = ['beta', 'internal']

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

const StageCell = ({ release }: { release: StageRelease | undefined }) =>
  release ? (
    <span className="stage-version" title={`${release.status} · updated ${new Date(release.updatedAt).toLocaleString()}`}>
      v{release.version}
    </span>
  ) : (
    <span className="muted">—</span>
  )

/**
 * Beta testing across the organization.
 *
 * Enrolment used to be reachable only from inside one app's page, which
 * answers "who tests this?" and never "what is this person testing?" or
 * "which builds are sitting on Staging with nobody to try them?". Those are
 * the questions somebody running a test cycle actually has, and neither is
 * scoped to a single app.
 */
export const Testing = () => {
  const [apps, setApps] = useState<TestingApp[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [track, setTrack] = useState<ReleaseTrack>('beta')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [enrolError, setEnrolError] = useState<string | null>(null)

  const load = () => {
    api
      .get<TestingApp[]>('/testing')
      .then(setApps)
      .catch((caught: unknown) => setFailure(errorText(caught, 'Could not load testing')))
  }

  useEffect(load, [])

  /*
   * The number worth surfacing: builds sitting on a pre-production stage with
   * nobody enrolled to try them. A test cycle that quietly has no testers
   * looks exactly like one that is going fine.
   */
  const stranded = useMemo(
    () =>
      (apps ?? []).filter(
        (app) => (app.stages.beta || app.stages.internal) && app.testers.length === 0,
      ),
    [apps],
  )

  const totalTesters = useMemo(
    () => new Set((apps ?? []).flatMap((app) => app.testers.map((t) => t.userId))).size,
    [apps],
  )

  const toggle = (slug: string) => {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const enrol = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setEnrolError(null)
    setResult(null)
    try {
      const outcome = await api.post<{
        enrolled: Tester[]
        failed: { slug: string; reason: string }[]
      }>('/testing/enrolments', { email, slugs: [...picked], track })

      // Partial success is reported as partial, not rounded to "done".
      const parts = [`Enrolled in ${outcome.enrolled.length} app${outcome.enrolled.length === 1 ? '' : 's'}`]
      if (outcome.failed.length > 0) {
        parts.push(outcome.failed.map((f) => `${f.slug}: ${f.reason}`).join('; '))
      }
      setResult(parts.join(' · '))
      setPicked(new Set())
      setEmail('')
      load()
    } catch (caught) {
      setEnrolError(errorText(caught, 'Could not enrol that person'))
    } finally {
      setBusy(false)
    }
  }

  const unenrol = async (slug: string, tester: Tester) => {
    if (!confirm(`Remove ${tester.email} from testing ${slug}?`)) return
    try {
      await api.del(`/apps/${slug}/testers/${encodeURIComponent(tester.email)}`)
      load()
    } catch (caught) {
      setFailure(errorText(caught, 'Could not remove that tester'))
    }
  }

  if (failure && !apps) return <Failed error={failure} onRetry={load} />
  if (!apps) return <Loading label="Loading testing" />

  return (
    <>
      <div className="page-head rise">
        <div>
          <h1>Testing</h1>
          <p>
            Who sees builds before everyone else, and what is waiting for them.
            Testing is granted per app on purpose — being asked to try one app
            is not a reason to see another team&rsquo;s unreleased work.
          </p>
        </div>
      </div>

      <div className="stat-strip rise" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="stat">
          <span className="stat-n">{apps.filter((a) => a.testers.length > 0).length}</span>
          <span className="stat-label">apps with testers</span>
        </div>
        <div className="stat">
          <span className="stat-n">{totalTesters}</span>
          <span className="stat-label">people testing</span>
        </div>
        <div className={`stat${stranded.length > 0 ? ' stat-warn' : ''}`}>
          <span className="stat-n">{stranded.length}</span>
          <span className="stat-label">builds with nobody to test them</span>
        </div>
      </div>

      {stranded.length > 0 && (
        <p className="notice rise" style={{ '--i': 2 } as React.CSSProperties}>
          Waiting with no testers enrolled:{' '}
          {stranded.map((app, index) => (
            <span key={app.slug}>
              {index > 0 && ', '}
              <Link to={`/apps/${app.slug}`}>{app.name}</Link>
            </span>
          ))}
        </p>
      )}

      <section className="section rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2>Enrol a tester</h2>
        <p className="section-sub">
          They must already be a member of this organization. Enrolling grants
          early sight of unreleased builds; it is not a way to join.
        </p>

        <form onSubmit={(event) => void enrol(event)}>
          <div className="inline-form">
            <div className="field">
              <label htmlFor="tester-email">Work email</label>
              <input
                id="tester-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@company.com"
              />
            </div>
            <div className="field" style={{ flex: '0 0 12rem' }}>
              <label htmlFor="tester-track">Sees from</label>
              <select
                id="tester-track"
                value={track}
                onChange={(event) => setTrack(event.target.value as ReleaseTrack)}
              >
                {TESTABLE.map((value) => (
                  <option key={value} value={value}>
                    {TRACK_LABELS[value].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="app-picker">
            <legend>Apps ({picked.size} selected)</legend>
            <div className="app-picker-grid">
              {apps.map((app) => (
                <label key={app.slug} className="app-check">
                  <input
                    type="checkbox"
                    checked={picked.has(app.slug)}
                    onChange={() => toggle(app.slug)}
                  />
                  <span>{app.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !email || picked.size === 0}
          >
            {busy ? 'Enrolling…' : `Enrol in ${picked.size || 'no'} app${picked.size === 1 ? '' : 's'}`}
          </button>
        </form>

        {result && <p className="ok-msg">{result}</p>}
        {enrolError && <p className="err-msg">{enrolError}</p>}
      </section>

      <section className="section rise" style={{ '--i': 4 } as React.CSSProperties}>
        <h2>By app</h2>
        {failure && <p className="err-msg">{failure}</p>}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>App</th>
                <th>{TRACK_LABELS.internal.label}</th>
                <th>{TRACK_LABELS.beta.label}</th>
                <th>{TRACK_LABELS.production.label}</th>
                <th>Testers</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.slug}>
                  <td>
                    <Link to={`/apps/${app.slug}`} className="app-link">
                      {app.name}
                    </Link>
                    <div className="member-email">{app.platform}</div>
                  </td>
                  <td className="nums"><StageCell release={app.stages.internal} /></td>
                  <td className="nums"><StageCell release={app.stages.beta} /></td>
                  <td className="nums"><StageCell release={app.stages.production} /></td>
                  <td>
                    {app.testers.length === 0 ? (
                      <span className="muted">nobody</span>
                    ) : (
                      <div className="tester-chips">
                        {app.testers.map((tester) => (
                          <button
                            key={tester.userId}
                            className="tester-chip"
                            title={`${tester.email} · sees from ${TRACK_LABELS[tester.track].label}. Click to remove.`}
                            onClick={() => void unenrol(app.slug, tester)}
                          >
                            {tester.displayName}
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
