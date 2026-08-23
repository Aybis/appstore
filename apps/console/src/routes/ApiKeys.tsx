import { useEffect, useState, type FormEvent } from 'react'

import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import { Failed, Loading } from '../ui/state'

type ApiKeyRole = 'viewer' | 'publisher'

interface ApiKey {
  id: string
  name: string
  prefix: string
  role: ApiKeyRole
  expiresAt: string
  revokedAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

interface MintedApiKey extends ApiKey {
  secret: string
}

const ROLE_LABEL: Record<ApiKeyRole, string> = {
  publisher: 'Publisher — can upload and promote builds',
  viewer: 'Read-only — can list apps and releases',
}

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * Three states, not two.
 *
 * A key that simply ran out is not the same as one somebody deliberately cut
 * off, and a list that showed both as "inactive" would hide the difference
 * exactly when it matters — a pipeline breaking at 3am is a very different
 * investigation depending on which one happened.
 */
const statusOf = (key: ApiKey): { label: string; tone: string } => {
  if (key.revokedAt) return { label: 'Revoked', tone: 'danger' }
  if (new Date(key.expiresAt).getTime() <= Date.now()) return { label: 'Expired', tone: 'internal' }
  return { label: 'Active', tone: 'production' }
}

/**
 * Shown once, immediately after minting, and never again.
 *
 * The server stores only an argon2 hash, so this is genuinely the only moment
 * the secret exists anywhere outside the machine that will use it. It is
 * deliberately loud, deliberately not dismissible by accident, and deliberately
 * not persisted anywhere in this app — a reload loses it, which is correct.
 */
const SecretPanel = ({ minted, onDone }: { minted: MintedApiKey; onDone: () => void }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <div className="secret-panel rise">
      <h3>Copy this now — it will not be shown again</h3>
      <p className="secret-help">
        MAYA stores only a hash of this key, so nobody can recover it later, not
        even an owner. If you lose it, revoke it and mint another.
      </p>

      <div className="secret-row">
        <code className="secret-value">{minted.secret}</code>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            void navigator.clipboard?.writeText(minted.secret).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <details className="secret-usage">
        <summary>How to use it</summary>
        <p className="secret-help">
          Send it as a bearer token, the same way a person&rsquo;s session token
          works. Store it in your CI provider&rsquo;s secret store — never in
          the repository.
        </p>
        <pre className="secret-snippet">
{`curl -X POST "$MAYA_API/v1/apps/<slug>/releases" \\
  -H "Authorization: Bearer $MAYA_API_KEY" \\
  -F file=@app.apk \\
  -F version=1.2.3 \\
  -F platform=android \\
  -F packageId=com.example.app \\
  -F track=internal`}
        </pre>
      </details>

      <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
        I&rsquo;ve saved it
      </button>
    </div>
  )
}

/**
 * Credentials for build servers.
 *
 * A pipeline cannot hold a password, so without these a release is pushed with
 * some engineer's own token — meaning either a human runs every deploy by hand
 * or a CI secret store holds a credential that can do everything that person
 * can.
 */
export const ApiKeys = () => {
  const { role } = useAuth()
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [keyRole, setKeyRole] = useState<ApiKeyRole>('publisher')
  const [days, setDays] = useState(90)
  const [busy, setBusy] = useState(false)
  /** Id of the key currently being revoked, so its button cannot be clicked twice. */
  const [revoking, setRevoking] = useState<string | null>(null)
  const [minted, setMinted] = useState<MintedApiKey | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  const load = () => {
    api
      .get<ApiKey[]>('/api-keys')
      .then(setKeys)
      .catch((caught: unknown) => setFailure(errorText(caught, 'Could not load API keys')))
  }

  useEffect(load, [])

  const mint = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMintError(null)
    try {
      const created = await api.post<MintedApiKey>('/api-keys', {
        name,
        role: keyRole,
        expiresInDays: days,
      })
      setMinted(created)
      setName('')
      load()
    } catch (caught) {
      setMintError(errorText(caught, 'Could not create that key'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (key: ApiKey) => {
    const warning = key.lastUsedAt
      ? `Revoke "${key.name}"? It was last used ${shortDate(key.lastUsedAt)}, so something is probably still using it.`
      : `Revoke "${key.name}"? It has never been used.`
    if (!confirm(warning)) return

    setRevoking(key.id)
    setFailure(null)
    try {
      await api.del(`/api-keys/${key.id}`)
    } catch (caught) {
      setFailure(errorText(caught, 'Could not revoke that key'))
    } finally {
      setRevoking(null)
      /*
       * Reloaded on failure too, not only on success. The likeliest reason a
       * revoke fails is that the key is no longer active — a double click, or
       * another admin got there first — and leaving a stale "Active" row next
       * to an error message describes neither what happened nor what is true.
       */
      load()
    }
  }

  if (failure && !keys) return <Failed error={failure} onRetry={load} />
  if (!keys) return <Loading label="Loading API keys" />

  const canManage = role === 'admin' || role === 'owner'

  return (
    <>
      <div className="page-head rise">
        <div>
          <h1>API keys</h1>
          <p>
            Credentials for build servers. A key can upload and promote builds;
            it can never manage people or mint another key, so a leaked key
            cannot outlive being revoked.
          </p>
        </div>
      </div>

      {minted && <SecretPanel minted={minted} onDone={() => setMinted(null)} />}

      {canManage && (
        <section className="section rise" style={{ '--i': 1 } as React.CSSProperties}>
          <h2>Create a key</h2>
          <form className="inline-form" onSubmit={(event) => void mint(event)}>
            <div className="field">
              <label htmlFor="key-name">What is it for</label>
              <input
                id="key-name"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="GitHub Actions — mobile"
              />
            </div>
            <div className="field" style={{ flex: '0 0 14rem' }}>
              <label htmlFor="key-role">Can do</label>
              <select
                id="key-role"
                value={keyRole}
                onChange={(event) => setKeyRole(event.target.value as ApiKeyRole)}
              >
                <option value="publisher">Upload builds</option>
                <option value="viewer">Read only</option>
              </select>
            </div>
            <div className="field" style={{ flex: '0 0 9rem' }}>
              <label htmlFor="key-days">Expires in</label>
              <select
                id="key-days"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !name}>
              {busy ? 'Creating…' : 'Create key'}
            </button>
          </form>
          <p className="field-hint">{ROLE_LABEL[keyRole]}. Expiry is not optional — a credential nobody rotates is one nobody owns.</p>
          {mintError && <p className="err-msg">{mintError}</p>}
        </section>
      )}

      <section className="section rise" style={{ '--i': 2 } as React.CSSProperties}>
        <h2>Existing keys</h2>
        {failure && <p className="err-msg">{failure}</p>}

        {keys.length === 0 ? (
          <p className="muted">No keys yet. Builds are being published by people signing in.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Can do</th>
                  <th>Last used</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const status = statusOf(key)
                  return (
                    <tr key={key.id}>
                      <td>
                        <div className="member-name">{key.name}</div>
                        <div className="member-email">created {shortDate(key.createdAt)}</div>
                      </td>
                      <td>
                        {/* The prefix identifies without authenticating — enough
                            to say which key, useless for acting as it. */}
                        <code className="key-prefix">{key.prefix}…</code>
                      </td>
                      <td>{key.role === 'publisher' ? 'Upload builds' : 'Read only'}</td>
                      <td className="nums">
                        {key.lastUsedAt ? shortDate(key.lastUsedAt) : <span className="muted">never</span>}
                      </td>
                      <td className="nums">{shortDate(key.expiresAt)}</td>
                      <td>
                        <span className={`pill pill-${status.tone}`}>{status.label}</span>
                      </td>
                      <td className="row-actions">
                        {canManage && !key.revokedAt && (
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={revoking === key.id}
                            onClick={() => void revoke(key)}
                          >
                            {revoking === key.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
