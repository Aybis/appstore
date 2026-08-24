import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { TRACK_LABELS } from '@appstore/shared/tracks'

import { api, ApiError } from '../api'
import { colorFor, initialsFor } from './Catalog'
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

/**
 * The version worth showing on a row: the furthest-along one.
 *
 * Production first, then Staging, then Development — a build that reached
 * everyone is the one people mean by "what version is this app", and falling
 * back down the stages means an app not yet released still shows something
 * rather than a blank.
 */
const displayVersion = (app: TestingApp): string | null =>
  app.stages.production?.version ?? app.stages.beta?.version ?? app.stages.internal?.version ?? null

/**
 * One row in the transfer list.
 *
 * Carries the icon, platform and version because a bare list of names cannot
 * answer the question somebody enrolling a tester actually has — an Android
 * build and an iOS build of the same product are different things to test, and
 * a name alone does not say which this is.
 */
const TransferRow = ({
  app,
  direction,
  onMove,
}: {
  app: TestingApp
  direction: 'add' | 'remove'
  onMove: () => void
}) => (
  <button
    type="button"
    className="transfer-item"
    draggable
    onDragStart={(event) => event.dataTransfer.setData('text/plain', app.slug)}
    onClick={onMove}
    aria-label={`${direction === 'add' ? 'Add' : 'Remove'} ${app.name}, ${app.platform}`}
  >
    {direction === 'remove' && (
      <span className="transfer-arrow" aria-hidden="true">←</span>
    )}
    <span className="transfer-icon" style={{ background: colorFor(app.slug) }} aria-hidden="true">
      {initialsFor(app.name)}
    </span>
    <span className="transfer-body">
      <span className="transfer-name">{app.name}</span>
      <span className="transfer-meta">
        {app.platform}
        {displayVersion(app) ? ` · v${displayVersion(app)}` : ''}
      </span>
    </span>
    {direction === 'add' && <span className="transfer-arrow" aria-hidden="true">→</span>}
  </button>
)

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
  const [filter, setFilter] = useState('')
  /** Which pane a drag is currently over, for the drop highlight. */
  const [dropTarget, setDropTarget] = useState<'available' | 'chosen' | null>(null)
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

  /*
   * Split rather than filtered twice at render: the two panes are the same
   * list partitioned by one predicate, and deriving them together keeps them
   * from ever disagreeing about which side an app is on.
   */
  const chosen = useMemo(
    () => apps?.filter((app) => picked.has(app.slug)) ?? [],
    [apps, picked],
  )

  const available = useMemo(() => {
    const query = filter.trim().toLowerCase()
    return (apps ?? []).filter(
      (app) => !picked.has(app.slug) && (!query || app.name.toLowerCase().includes(query)),
    )
  }, [apps, picked, filter])

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

          {/*
            * A transfer list, not a grid of checkboxes.
            *
            * Seventeen checkboxes tell you what exists and nothing about what
            * you have chosen — the selection is scattered through the options,
            * so "who am I about to enrol this person in" has to be reassembled
            * by eye every time. Two panels make the answer a place you look
            * rather than a thing you count.
            *
            * Click is the primary interaction and drag is an enhancement, in
            * that order deliberately: drag is awkward on a touchscreen and
            * impossible from a keyboard, so every row is a real <button> that
            * moves on Enter or Space, and dragging is something extra for
            * people using a mouse.
            */}
          <div className="transfer">
            <div
              className={`transfer-pane${dropTarget === 'available' ? ' transfer-over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDropTarget('available')
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => {
                event.preventDefault()
                setDropTarget(null)
                const slug = event.dataTransfer.getData('text/plain')
                if (slug) setPicked((current) => {
                  const next = new Set(current)
                  next.delete(slug)
                  return next
                })
              }}
            >
              <div className="transfer-head">
                <h3>All apps</h3>
                <span className="transfer-count">{available.length}</span>
              </div>

              <input
                className="transfer-search"
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter…"
                aria-label="Filter apps"
              />

              <ul className="transfer-list">
                {available.map((app) => (
                  <li key={app.slug}>
                    <TransferRow app={app} direction="add" onMove={() => toggle(app.slug)} />
                  </li>
                ))}
                {available.length === 0 && (
                  <li className="transfer-empty">
                    {filter ? 'Nothing matches that.' : 'All apps chosen.'}
                  </li>
                )}
              </ul>
            </div>

            <div
              className={`transfer-pane transfer-chosen${dropTarget === 'chosen' ? ' transfer-over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDropTarget('chosen')
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(event) => {
                event.preventDefault()
                setDropTarget(null)
                const slug = event.dataTransfer.getData('text/plain')
                if (slug) setPicked((current) => new Set(current).add(slug))
              }}
            >
              <div className="transfer-head">
                <h3>Will test</h3>
                <span className="transfer-count transfer-count-on">{chosen.length}</span>
              </div>

              <ul className="transfer-list">
                {chosen.map((app) => (
                  <li key={app.slug}>
                    <TransferRow app={app} direction="remove" onMove={() => toggle(app.slug)} />
                  </li>
                ))}
                {chosen.length === 0 && (
                  <li className="transfer-empty">
                    Pick apps on the left, or drag them here.
                  </li>
                )}
              </ul>
            </div>
          </div>

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
