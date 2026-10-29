import { TRACK_LABELS, TRACK_ORDER } from '@appstore/shared/tracks'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { api, ApiError } from '../services/api'
import { isStaff, useAuth } from '../services/auth'
import { AppIcon, Button, Card, Failed, Field, Loading, Message, PageHeader, TrackPill, useConfirm } from '../components'
import type { ManagedApp, PublishedRelease, ReleaseSummary, ReleaseTrack, Tester } from '../types'

/* Order and names both come from the shared contract, so the console and the
   API cannot drift on what "Staging" means. */
const TRACKS: readonly ReleaseTrack[] = TRACK_ORDER

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

export const AppDetail = () => {
  const { slug = '' } = useParams()
  const { role } = useAuth()
  const staff = isStaff(role)

  const [app, setApp] = useState<ManagedApp | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    api
      .get<ManagedApp>(`/manage/apps/${slug}`)
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

      <PageHeader
        animate={false}
        leading={<AppIcon seed={app.slug} name={app.name} size="3.5rem" />}
        title={app.name}
        description={
          <>
            {app.publisher || 'Unknown publisher'} · <span className="mono">{app.packageId}</span>
          </>
        }
      />

      <Card>
        <div className="form-grid">
          <Fact label="Latest version" value={app.latestVersion ? `v${app.latestVersion}` : 'No builds yet'} />
          <Fact label="Platform" value={app.platform} />
          <Fact label="Package ID" value={app.packageId || 'Not set'} />
          <Fact label="Category" value={app.category || '—'} />
        </div>
      </Card>

      {staff ? (
        <>
          <UploadSection slug={slug} onDone={load} />
          <ReleaseSection slug={slug} />
          <TesterSection slug={slug} />
        </>
      ) : (
        <Message tone="notice" style={{ marginTop: '2rem' }}>
          Publishing and tester management need a publisher role.
        </Message>
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
  const [sent, setSent] = useState(0)
  const [result, setResult] = useState<PublishedRelease | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const percent = file && file.size > 0 ? Math.min(100, Math.floor((sent / file.size) * 100)) : 0

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setSent(0)
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
      setResult(
        await api.upload<PublishedRelease>(`/apps/${slug}/releases`, form, (loaded) =>
          setSent(loaded),
        ),
      )
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
            <Field label="Version">
              <input
                required
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="1.1.0"
              />
            </Field>
            <Field label="Package id">
              <input
                required
                value={packageId}
                onChange={(event) => setPackageId(event.target.value)}
                placeholder="com.maya.calculator"
              />
            </Field>
            <Field label="Platform">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as 'android' | 'ios')}
              >
                <option value="android">android</option>
                <option value="ios">ios</option>
              </select>
            </Field>
            <Field label="Release to" hint={<>{TRACK_LABELS[track].audience}</>}>
              <select
                value={track}
                onChange={(event) => setTrack(event.target.value as ReleaseTrack)}
              >
                {TRACKS.map((value) => (
                  <option key={value} value={value}>
                    {TRACK_LABELS[value].label}
                  </option>
                ))}
              </select>
              {/* Who this actually reaches, said plainly next to the choice —
                  the one thing somebody uploading a build needs to be sure of. */}
            </Field>
          </div>

          <Field label="Release notes">
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What changed in this build?"
            />
          </Field>

          {busy && file && (
            <div className="upload-progress" role="status" aria-live="polite">
              <div className="upload-progress-head">
                <span>
                  {percent < 100
                    ? `Uploading… ${percent}%`
                    : 'Sent. The server is checking and storing the build…'}
                </span>
                <span className="mono">
                  {(Math.min(sent, file.size) / (1024 * 1024)).toFixed(1)} /{' '}
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <div
                className="upload-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="upload-progress-bar" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

          {failure && <Message tone="error">{failure}</Message>}
          {result && (
            <Message tone="success">
              Published v{result.version} to{' '}
              <strong>{TRACK_LABELS[result.track].label}</strong> ·{' '}
              <span className="mono">{result.sha256.slice(0, 16)}…</span>
            </Message>
          )}

          <div>
            <Button variant="primary" type="submit" disabled={busy || !file}>
              {busy ? 'Uploading…' : 'Upload build'}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}

/** Releases, newest first, with promotion inline on each row. */
const ReleaseSection = ({ slug }: { slug: string }) => {
  const confirm = useConfirm()
  const [releases, setReleases] = useState<ReleaseSummary[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { role } = useAuth()
  // Same bar the API enforces: this replaces the download every visitor is offered.
  const canPublishClient = role === 'admin' || role === 'owner'

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

  const publishAsClient = async (release: ReleaseSummary) => {
    const sure = await confirm({
      title: `Publish v${release.version} as the MAYA app?`,
      body: 'Anyone who opens the public download page will be offered this file. It replaces the current one.',
      confirmLabel: 'Publish',
    })
    if (!sure) return
    setBusyId(release.id)
    setFailure(null)
    setNotice(null)
    try {
      const build = await api.post<{ version: string; versionCode: number }>('/client/publish', {
        releaseId: release.id,
      })
      setNotice(
        `MAYA ${build.version} (build ${build.versionCode}) is now the download on the landing page.`,
      )
    } catch (caught) {
      setFailure(errorText(caught, 'Could not publish this build as the MAYA app'))
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

        {failure && <Message tone="error" style={{ marginBottom: '.9rem' }}>{failure}</Message>}
        {notice && <Message tone="success" style={{ marginBottom: '.9rem' }}>{notice}</Message>}

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
                        <Button
                          key={track} variant="ghost" size="sm"
                          disabled={busyId === release.id}
                          onClick={() => void promote(release, track)}
                        >
                          → {TRACK_LABELS[track].label}
                        </Button>
                      ))
                    )}
                    {canPublishClient &&
                      release.platform === 'android' &&
                      release.status === 'published' && (
                        <Button variant="ghost" size="sm"
                          disabled={busyId === release.id}
                          title="Make this the app people download from the landing page"
                          onClick={() => void publishAsClient(release)}
                        >
                          Publish as MAYA app
                        </Button>
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
          <Field label="Member email">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tester@company.com"
            />
          </Field>
          <Field label="Sees from" style={{ flex: '0 0 10rem' }}>
            {/* Earliest stage this tester may see. Ordered loosest-first:
                Staging is the ordinary case, Development the exception. */}
            <select value={track} onChange={(event) => setTrack(event.target.value as ReleaseTrack)}>
              <option value="beta">{TRACK_LABELS.beta.label}</option>
              <option value="internal">{TRACK_LABELS.internal.label}</option>
            </select>
          </Field>
          <Button variant="primary" type="submit" disabled={busy || !email}>
            {busy ? 'Adding…' : 'Add tester'}
          </Button>
        </form>

        {failure && <Message tone="error" style={{ marginTop: '.9rem' }}>{failure}</Message>}

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
                    <Button variant="ghost" size="sm" onClick={() => remove(tester.email)}>
                      Remove
                    </Button>
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
