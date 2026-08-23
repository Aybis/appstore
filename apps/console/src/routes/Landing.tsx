import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { config } from '../config'
import { MayaMark } from '../ui/MayaMark'
import { detectTargets, phoneQuery, type Target } from '../ui/platform'
import './landing.css'

interface ClientBuild {
  platform: Target
  version: string
  versionCode: number
  sizeBytes: number
  sha256: string
  packageId: string
  minOsLabel: string
  abis: string[]
  releasedAt: string
}

const megabytes = (bytes: number): string => `${(bytes / 1_000_000).toFixed(0)} MB`

/** Grouped so a 64-character hex string is checkable by eye. */
const grouped = (sha: string): string => (sha.match(/.{1,8}/g) ?? []).join(' ')

const LABELS: Record<Target, string> = { android: 'Android', ios: 'iPhone & iPad' }

const Fingerprint = ({ sha256 }: { sha256: string }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <details className="fingerprint">
      <summary>Check the file is genuine</summary>
      <p className="fingerprint-help">
        Compare this code with the one your phone shows after downloading. They
        should match exactly.
      </p>
      <div className="fingerprint-head">
        <span className="fingerprint-label">SHA-256</span>
        <button
          type="button"
          className="copy"
          onClick={() => {
            void navigator.clipboard?.writeText(sha256).then(() => setCopied(true))
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="fingerprint-value">{grouped(sha256)}</code>
    </details>
  )
}

const DownloadCard = ({
  target,
  build,
  portalUrl,
  showQr,
}: {
  target: Target
  build: ClientBuild | null
  portalUrl: string | null
  showQr: boolean
}) => {
  const href = `${config.apiBaseUrl}${config.apiPrefix}/client/${target}/download`

  if (!build) {
    return (
      <div className="download-card download-card-muted">
        <div className="download-head">
          <h2>{LABELS[target]}</h2>
          <span className="pill pill-internal">Coming soon</span>
        </div>
        <div className="download-body">
          <p className="download-soon">
            {target === 'ios'
              ? 'Not ready yet. Ask your IT team if you need it now.'
              : 'No build has been published for this platform yet.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="download-card">
      <div className="download-head">
        <div>
          <h2>{LABELS[target]}</h2>
          <p className="download-meta">
            Version {build.version} · {megabytes(build.sizeBytes)} ·{' '}
            {build.minOsLabel} or newer
          </p>
        </div>
      </div>

      <div className="download-body">
        <div className="download-actions">
          {/* Just "Download" — the card is already headed with the platform,
              and "Download for iPhone & iPad" wraps to two lines in the space
              the QR leaves. The aria-label keeps it unambiguous out of context. */}
          <a
            className="btn btn-primary btn-block pressable"
            href={href}
            aria-label={`Download MAYA for ${LABELS[target]}`}
          >
            Download
          </a>
          <Fingerprint sha256={build.sha256} />
        </div>

        {showQr && portalUrl ? (
          <figure className="qr">
            <img
              src={`${config.apiBaseUrl}${config.apiPrefix}/client/qr.svg`}
              alt={`QR code linking to ${portalUrl}`}
              width={148}
              height={148}
              loading="lazy"
            />
            <figcaption>Scan to open this page on your phone</figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The download portal.
 *
 * Two things shape this page, both learned the hard way.
 *
 * It leads with the download because the page used to explain the product and
 * send everyone to the console, which left the first step missing: somebody
 * handed a work phone had no way to install the app that installs the apps.
 *
 * And it says what MAYA is in one plain sentence, because the version that
 * opened with tracks, promotion and update semantics described how the system
 * works to people who did not yet know what it was for. Those concepts belong
 * in the console, where somebody publishing a release needs them.
 *
 * It is also the fallback for every deep link — an https App Link opens the app
 * when installed and lands here when not, which is exactly the visitor who
 * needs a download button above the fold.
 */
export const Landing = () => {
  const [builds, setBuilds] = useState<ClientBuild[] | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [targets, setTargets] = useState<Target[]>(detectTargets)

  useEffect(() => {
    fetch(`${config.apiBaseUrl}${config.apiPrefix}/client`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('unavailable'))))
      .then((data: { builds: ClientBuild[]; portalUrl: string | null }) => {
        setBuilds(data.builds)
        setPortalUrl(data.portalUrl)
      })
      .catch(() => setFailed(true))
  }, [])

  // Re-detect when the window crosses the phone breakpoint, so a Mac switched
  // into a responsive preview shows the iPhone view without a reload.
  useEffect(() => {
    const media = window.matchMedia(phoneQuery)
    const update = () => setTargets(detectTargets())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const buildFor = (target: Target) => builds?.find((build) => build.platform === target) ?? null
  const onlyOne = targets.length === 1

  return (
    <div className="landing">
      <header className="landing-nav rise" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="brand">
          <MayaMark size={30} />
          <span className="brand-name">MAYA</span>
        </div>
        <nav className="landing-nav-links">
          <a href="#install">Install</a>
          <Link className="nav-cta pressable" to="/login">
            Open console
          </Link>
        </nav>
      </header>

      {/* The download comes before the explanation on a phone. A visitor who
          arrived here to install should not have to scroll past a paragraph to
          reach the button; on a wide screen the two sit side by side and the
          order stops mattering. */}
      <section className="hero" id="install">
        <h1 className="hero-title rise" style={{ '--i': 1 } as React.CSSProperties}>
          All your work apps, in one place.
        </h1>

        <div className="download-stack rise" style={{ '--i': 2 } as React.CSSProperties}>
          {failed && (
            <div className="download-card">
              <div className="download-empty">
                <h2>Downloads are unavailable</h2>
                <p>Something is wrong on our side. Try again shortly.</p>
              </div>
            </div>
          )}

          {!failed && !builds && <div className="download-skeleton" aria-label="Loading" />}

          {!failed &&
            builds &&
            targets.map((target) => (
              <DownloadCard
                key={target}
                target={target}
                build={buildFor(target)}
                portalUrl={portalUrl}
                showQr={onlyOne ? false : target === 'android'}
              />
            ))}
        </div>

        <p className="hero-sub rise" style={{ '--i': 3 } as React.CSSProperties}>
          MAYA is your company&rsquo;s own app store. Install it once and the
          apps your company builds are all here, kept up to date.
        </p>
      </section>

      <section className="panel" id="how">
        <h2>Installing it</h2>
        <ol className="steps">
          <li className="rise" style={{ '--i': 0 } as React.CSSProperties}>
            <span className="step-n">1</span>
            <div>
              <h3>Download it on your phone</h3>
              <p>
                Your browser will warn you before saving the file. That warning
                appears for every app installed this way — keep the file.
              </p>
            </div>
          </li>
          <li className="rise" style={{ '--i': 1 } as React.CSSProperties}>
            <span className="step-n">2</span>
            <div>
              <h3>Say yes when your phone asks</h3>
              <p>
                Your phone asks permission the first time your browser installs
                an app. You are allowing that one browser, not everything.
              </p>
            </div>
          </li>
          <li className="rise" style={{ '--i': 2 } as React.CSSProperties}>
            <span className="step-n">3</span>
            <div>
              <h3>Sign in with your work account</h3>
              <p>
                Your apps appear. You only ever see the ones you are meant to
                have.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="panel doors">
        <h2>Built something? Publish it here.</h2>
        <p className="panel-sub">
          If you make apps for this company, the console is where you upload a
          build, test it with a few people first, and release it when it is
          ready.
        </p>
        <Link className="btn btn-primary" to="/login">
          Open the console
        </Link>
      </section>

      <footer className="landing-foot">
        <div className="brand">
          <MayaMark size={22} />
          <span className="brand-name">MAYA</span>
        </div>
        <p>
          Internal distribution for {new URL(config.siteUrl).hostname}. Not
          affiliated with any public app store.
        </p>
      </footer>
    </div>
  )
}
