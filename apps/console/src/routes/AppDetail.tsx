import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, ApiError } from '../api'
import { isStaff, useAuth } from '../auth'
import { Card, Failed, Loading, TrackPill } from '../ui/state'
import { colorFor, initialsFor } from './Catalog'
import type {
  CatalogApp,
  PublishedRelease,
  ReleaseSummary,
  ReleaseTrack,
  Tester,
} from '../types'

const TRACKS: readonly ReleaseTrack[] = ['internal', 'beta', 'production']

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

export const AppDetail = () => {
  const { slug = '' } = useParams()
  const { role } = useAuth()
  const staff = isStaff(role)

  const [app, setApp] = useState<CatalogApp | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    api
      .get<CatalogApp>(`/apps/${slug}`)
      .then(setApp)
      .catch((caught: unknown) => setError(errorText(caught, 'Could not load this app')))
  }, [slug])

  useEffect(load, [load])

  if (error) return <Failed error={error} onRetry={load} />
  if (!app) return <Loading label="Loading the app…" />

  return (
    <>
      <p style={{ margin: '0 0 1rem' }}>
        <Link to="/apps">← All apps</Link>
      </p>

      <div className="page-head">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span
            className="app-icon"
            style={{ background: colorFor(app.slug), width: '3.5rem', height: '3.5rem' }}
          >
            {initialsFor(app.name)}
          </span>
          <div>
            <h1>{app.name}</h1>
            <p>
              {app.publisher || 'Unknown publisher'} · <span className="mono">{app.packageId}</span>
            </p>
          </div>
        </div>
      </div>

      <Card>
        <div className="form-grid">
          <Fact label="Latest version" value={`v${app.version}`} />
          <Fact label="Platform" value={app.platform} />
          <Fact label="Minimum OS" value={app.minOs || '—'} />
          <Fact label="Category" value={app.category} />
        </div>
      </Card>

      {staff ? (
        <>
          <UploadSection slug={slug} onDone={load} />
          <ReleaseSection slug={slug} />
          <TesterSection slug={slug} />
        </>
      ) : (
        <p className="notice" style={{ marginTop: '2rem' }}>
          Publishing and tester management need a publisher role.
        </p>
      )}
    </>
  )
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div
      className="mono"
      style={{
        fontSize: '.66rem',
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--text-3)',
      }}
    >
      {label}
    </div>
    <div style={{ fontWeight: 600, marginTop: '.2rem' }}>{value}</div>
  </div>
)

/**
 * Upload defaults to the `internal` track, matching the API.
 *
 * The default is repeated here rather than left implicit because this is the
 * screen where somebody decides where a build goes — a publisher should see
 * that "internal" was chosen for them, not discover it afterwards.
 */
const UploadSection = ({ slug, onDone }: { slug: string; onDone: () => void }) => {
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState('')
  const [packageId, setPackageId] = useState('')
  const [platform, setPlatform] = useState<'android' | 'ios'>('android')
  const [track, setTrack] = useState<ReleaseTrack>('internal')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PublishedRelease | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setFailure(null)
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('version', version)
    form.append('platform', platform)
    form.append('packageId', packageId)
    form.append('track', track)
    form.append('publish', 'true')
    if (notes.trim()) form.append('releaseNotes', notes.trim())

    try {
      setResult(await api.upload<PublishedRelease>(`/apps/${slug}/releases`, form))
      setFile(null)
      setVersion('')
      onDone()
    } catch (caught) {
      setFailure(errorText(caught, 'Upload failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <h2>Upload a build</h2>
      <Card>
        <form onSubmit={submit} style={{ display: 'grid', gap: '1rem' }}>
          <label className="upload-drop" style={{ display: 'block', cursor: 'pointer' }}>
            <input
              type="file"
              accept=".apk,.ipa"
              style={{ display: 'none' }}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <strong>{file.name}</strong>
                <div>{(file.size / (1024 * 1024)).toFixed(1)} MB — click to replace</div>
              </>
            ) : (
              <>
                <strong>Choose an .apk or .ipa</strong>
                <div>The digest is computed server-side from the bytes received.</div>
              </>
            )}
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Version</span>
              <input
                required
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.1.0"
              />
            </label>
            <label className="field">
              <span>Package id</span>
              <input
                required
                value={packageId}
                onChange={(event) => setPackageId(event.target.value)}
                placeholder="com.internal.calculator"
              />
            </label>
            <label className="field">
              <span>Platform</span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as 'android' | 'ios')}
              >
                <option value="android">android</option>
                <option value="ios">ios</option>
              </select>
            </label>
            <label className="field">
              <span>Track</span>
              <select
                value={track}
                onChange={(event) => setTrack(event.target.value as ReleaseTrack)}
              >
                {TRACKS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Release notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What changed in this build?"
            />
          </label>

          {failure && <p className="err-msg">{failure}</p>}
          {result && (
            <p className="ok-msg">
              Published v{result.version} to <strong>{result.track}</strong> ·{' '}
              <span className="mono">{result.sha256.slice(0, 16)}…</span>
            </p>
          )}

          <div>
            <button className="btn btn-primary" type="submit" disabled={busy || !file}>
              {busy ? 'Uploading…' : 'Upload build'}
            </button>
          </div>
        </form>
      </Card>
    </section>
  )
}

/** Releases, newest first, with promotion inline on each row. */
const ReleaseSection = ({ slug }: { slug: string }) => {
  const [releases, setReleases] = useState<ReleaseSummary[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    api
      .get<ReleaseSummary[]>(`/apps/${slug}/releases`)
      .then(setReleases)
      .catch((caught: unknown) => setFailure(errorText(caught, 'Could not load releases')))
  }, [slug])

  useEffect(load, [load])

  const promote = async (release: ReleaseSummary, to: ReleaseTrack) => {
    setBusyId(release.id)
    setFailure(null)
    try {
      await api.post(`/apps/${slug}/releases/${release.id}/promote`, { track: to })
      load()
    } catch (caught) {
      setFailure(errorText(caught, 'Promotion failed'))
    } finally {
      setBusyId(null)
    }
  }

  /** Promotion only moves forward, so only later tracks are offered. */
  const nextTracks = (track: ReleaseTrack): ReleaseTrack[] =>
    TRACKS.slice(TRACKS.indexOf(track) + 1)

  return (
    <section className="section">
      <h2>Releases</h2>
      <Card>
        <p style={{ marginTop: 0, color: 'var(--text-2)', fontSize: '.93rem' }}>
          Promotion moves an existing build forward without rebuilding it, so the
          binary your QA approved is the one that ships. It only ever moves
          forward — withdrawing a bad build is a separate, deliberate act.
        </p>

        {failure && <p className="err-msg" style={{ marginBottom: '.9rem' }}>{failure}</p>}

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Version</th>
                <th>Platform</th>
                <th>Track</th>
                <th>Status</th>
                <th>Promote to</th>
              </tr>
            </thead>
            <tbody>
              {releases?.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-3)' }}>
                    No releases yet — upload a build above.
                  </td>
                </tr>
              )}
              {releases?.map((release) => (
                <tr key={release.id}>
                  <td>
                    <strong>v{release.version}</strong>
                    <div className="mono" style={{ fontSize: '.75rem', color: 'var(--text-3)' }}>
                      {release.sha256 ? `${release.sha256.slice(0, 12)}…` : 'no artifact'}
                    </div>
                  </td>
                  <td className="mono">{release.platform}</td>
                  <td>
                    <TrackPill track={release.track} />
                  </td>
                  <td className="mono" style={{ color: 'var(--text-3)' }}>
                    {release.status}
                  </td>
                  <td className="row-actions">
                    {nextTracks(release.track).length === 0 ? (
                      <span style={{ color: 'var(--text-3)', fontSize: '.85rem' }}>
                        Fully released
                      </span>
                    ) : (
                      nextTracks(release.track).map((track) => (
                        <button
                          key={track}
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === release.id}
                          onClick={() => void promote(release, track)}
                        >
                          → {track}
                        </button>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}

const TesterSection = ({ slug }: { slug: string }) => {
  const [testers, setTesters] = useState<Tester[] | null>(null)
  const [email, setEmail] = useState('')
  const [track, setTrack] = useState<ReleaseTrack>('beta')
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api
      .get<Tester[]>(`/apps/${slug}/testers`)
      .then(setTesters)
      .catch((caught: unknown) => setFailure(errorText(caught, 'Could not load testers')))
  }, [slug])

  useEffect(load, [load])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setFailure(null)
    try {
      await api.post<Tester>(`/apps/${slug}/testers`, { email, track })
      setEmail('')
      load()
    } catch (caught) {
      setFailure(errorText(caught, 'Could not add that tester'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (address: string) => {
    setFailure(null)
    try {
      await api.del(`/apps/${slug}/testers/${encodeURIComponent(address)}`)
      load()
    } catch (caught) {
      setFailure(errorText(caught, 'Could not remove that tester'))
    }
  }

  return (
    <section className="section">
      <h2>
        Beta testers <TrackPill track="beta" />
      </h2>
      <Card>
        <p style={{ marginTop: 0, color: 'var(--text-2)', fontSize: '.93rem' }}>
          Enrolment grants an existing member early access to this app. It is not
          a way to join the organization — invite them first.
        </p>

        <form className="inline-form" onSubmit={add}>
          <label className="field">
            <span>Member email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tester@company.com"
            />
          </label>
          <label className="field" style={{ flex: '0 0 10rem' }}>
            <span>Sees from</span>
            <select value={track} onChange={(event) => setTrack(event.target.value as ReleaseTrack)}>
              <option value="beta">beta</option>
              <option value="internal">internal</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy || !email}>
            {busy ? 'Adding…' : 'Add tester'}
          </button>
        </form>

        {failure && <p className="err-msg" style={{ marginTop: '.9rem' }}>{failure}</p>}

        <div className="table-wrap" style={{ marginTop: '1.2rem' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Tester</th>
                <th>Sees from</th>
                <th>Since</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {testers?.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text-3)' }}>
                    Nobody enrolled yet.
                  </td>
                </tr>
              )}
              {testers?.map((tester) => (
                <tr key={tester.userId}>
                  <td>
                    {tester.displayName}
                    <div className="muted mono" style={{ fontSize: '.8rem' }}>
                      {tester.email}
                    </div>
                  </td>
                  <td>
                    <TrackPill track={tester.track} />
                  </td>
                  <td className="mono" style={{ color: 'var(--text-3)' }}>
                    {new Date(tester.createdAt).toLocaleDateString()}
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(tester.email)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  )
}
