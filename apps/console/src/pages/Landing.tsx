import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { config } from '../config'
import {
  AppsIcon,
  ButtonLink,
  DeviceIcon,
  DownloadIcon,
  MayaMark,
  PeopleIcon,
  ReleaseIcon,
} from '../components'
import { detectTargets, isPhoneVisitor, phoneQuery, type Target } from '../utils/platform'
import './landing.css'

interface ClientBuild {
  platform: Target
  version: string
  versionCode: number
  sizeBytes: number
  packageId: string
  minOsLabel: string
  abis: string[]
  releasedAt: string
}

interface PublicStats {
  users: number
  apps: number
  installs: number
  devices: number
  releases: number
}

const api = `${config.apiBaseUrl}${config.apiPrefix}`

const megabytes = (bytes: number): string => `${(bytes / 1_000_000).toFixed(0)} MB`

const LABELS: Record<Target, string> = { android: 'Android', ios: 'iPhone & iPad' }

/** Grouped below ten thousand ("1,284"), compact above it ("12K"). */
const formatCount = (value: number): string =>
  new Intl.NumberFormat('en', value >= 10_000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(
    value,
  )

/**
 * The install card: one platform at a time, with a QR that DOWNLOADS the
 * build rather than opening this page on the phone.
 *
 * The QR used to link back to the portal, so a visitor at a desk scanned it,
 * landed on the same page on their phone, and had to find the button again.
 * Now the camera hands straight to the download. It is still only shown at a
 * desk — a QR on a phone is a code the visitor cannot point their own camera
 * at — and only when the API knows an address a phone can reach (`qr`).
 */
const InstallCard = ({
  builds,
  failed,
  targets,
  phone,
  qr,
}: {
  builds: ClientBuild[] | null
  failed: boolean
  targets: Target[]
  phone: boolean
  qr: boolean
}) => {
  const buildFor = (target: Target) => builds?.find((build) => build.platform === target) ?? null
  // Open on the first platform that has something to download, so a desk
  // visitor sees a working QR rather than a "coming soon" tab.
  const preferred = targets.find((target) => buildFor(target)) ?? targets[0] ?? 'android'
  const [chosen, setChosen] = useState<Target | null>(null)
  const target = chosen && targets.includes(chosen) ? chosen : preferred
  const build = buildFor(target)
  const showQr = Boolean(build) && qr && !phone

  return (
    <div className="install-card">
      <span className="install-screw" aria-hidden="true" />
      <span className="install-screw" aria-hidden="true" />
      <span className="install-screw" aria-hidden="true" />
      <span className="install-screw" aria-hidden="true" />

      {targets.length > 1 && (
        <div className="install-tabs" role="tablist" aria-label="Platform">
          {targets.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={option === target}
              className="install-tab pressable"
              onClick={() => setChosen(option)}
            >
              {LABELS[option]}
            </button>
          ))}
        </div>
      )}

      {failed && (
        <div className="install-empty">
          <h2>Downloads are unavailable</h2>
          <p>The download service did not answer. Reload the page in a minute.</p>
        </div>
      )}

      {!failed && !builds && <div className="install-skeleton" aria-label="Loading" />}

      {!failed && builds && !build && (
        <div className="install-empty">
          <h2>MAYA for {LABELS[target]} is coming</h2>
          <p>
            {target === 'ios'
              ? 'The iPhone build is not ready yet. Ask your IT team if you need it now.'
              : 'No Android build has been published yet.'}
          </p>
        </div>
      )}

      {!failed && build && (
        <div className={showQr ? 'install-body install-body-qr' : 'install-body'}>
          {showQr && (
            <img
              className="install-qr"
              src={`${api}/client/${target}/qr.svg`}
              alt={`QR code that downloads MAYA for ${LABELS[target]}`}
              width={168}
              height={168}
            />
          )}

          <div className="install-copy">
            <h2>Get MAYA on {LABELS[target]}</h2>
            <p className="install-lede">
              {showQr
                ? 'Point your phone’s camera at the code. The download starts straight away.'
                : 'Tap download, then open the file to install it.'}
            </p>
            <dl className="install-facts">
              <div>
                <dt>Version</dt>
                <dd>{build.version}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{megabytes(build.sizeBytes)}</dd>
              </div>
              <div>
                <dt>Needs</dt>
                <dd>{build.minOsLabel}+</dd>
              </div>
            </dl>
            <a
              className={showQr ? 'install-link pressable' : 'btn btn-primary btn-block pressable'}
              href={`${api}/client/${target}/download`}
              aria-label={`Download MAYA for ${LABELS[target]}`}
            >
              <DownloadIcon />
              {showQr ? 'Or download the file' : 'Download'}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

const STATS: { key: keyof PublicStats; label: string; detail: string; tint: string; icon: React.ComponentType }[] = [
  { key: 'users', label: 'People signed up', detail: 'with a work account', tint: 'coral', icon: PeopleIcon },
  { key: 'apps', label: 'Apps published', detail: 'ready to install', tint: 'violet', icon: AppsIcon },
  { key: 'releases', label: 'Releases shipped', detail: 'versions made live', tint: 'sky', icon: ReleaseIcon },
  { key: 'installs', label: 'Installs', detail: 'and updates on devices', tint: 'teal', icon: DownloadIcon },
  { key: 'devices', label: 'Devices', detail: 'running MAYA', tint: 'amber', icon: DeviceIcon },
]

/**
 * Real totals for the whole deployment, from /v1/stats. Hidden entirely if
 * that call fails: an empty strip of dashes says "broken", not "new".
 */
const StatsStrip = () => {
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch(`${api}/stats`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('unavailable'))))
      .then((data: PublicStats) => setStats(data))
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null

  return (
    <section className="counts" aria-labelledby="counts-title">
      <h2 id="counts-title" className="visually-hidden">
        MAYA in numbers
      </h2>
      <ul className="counts-row" aria-busy={!stats}>
        {STATS.map(({ key, label, detail, tint, icon: Icon }) => (
          <li key={key} className="count">
            <span className={`count-chip count-chip-${tint}`}>
              <Icon />
            </span>
            {stats ? (
              <span className="count-value">{formatCount(stats[key])}</span>
            ) : (
              <span className="count-value count-value-loading" aria-hidden="true" />
            )}
            <span className="count-label">{label}</span>
            <span className="count-detail">{detail}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The download portal.
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
  const [qr, setQr] = useState(false)
  const [failed, setFailed] = useState(false)
  const [targets, setTargets] = useState<Target[]>(detectTargets)
  const [phone, setPhone] = useState(isPhoneVisitor)

  useEffect(() => {
    fetch(`${api}/client`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('unavailable'))))
      .then((data: { builds: ClientBuild[]; qr?: boolean }) => {
        setBuilds(data.builds)
        setQr(data.qr === true)
      })
      .catch(() => setFailed(true))
  }, [])

  // Re-detect when the window crosses the phone breakpoint, so a Mac switched
  // into a responsive preview shows the iPhone view without a reload.
  useEffect(() => {
    const media = window.matchMedia(phoneQuery)
    const update = () => {
      setTargets(detectTargets())
      setPhone(isPhoneVisitor())
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return (
    <div className="landing">
      <div className="landing-glow" aria-hidden="true" />

      <header className="landing-nav rise" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="landing-nav-bar">
          <Link to="/" className="brand landing-brand">
            <MayaMark size={28} />
            <span className="brand-name">MAYA</span>
          </Link>
          <nav className="landing-nav-links" aria-label="Page">
            <a href="#install">Install</a>
            <a href="#how">How it works</a>
            <a href="#publish">Publish</a>
          </nav>
          <Link className="nav-cta pressable" to="/login">
            Sign in
          </Link>
        </div>
      </header>

      {/* The download comes before the explanation on a phone. A visitor who
          arrived here to install should not have to scroll past a paragraph to
          reach the button; on a wide screen the two sit side by side and the
          order stops mattering. */}
      <section className="hero hero-portal" id="install">
        <p className="hero-eyebrow rise" style={{ '--i': 1 } as React.CSSProperties}>
          <MayaMark size={16} />
          Your company&rsquo;s own app store
        </p>

        <h1 className="hero-title rise" style={{ '--i': 1 } as React.CSSProperties}>
          All your work apps, <span className="hero-title-quiet">in one place.</span>
        </h1>

        <div className="hero-card rise" style={{ '--i': 2 } as React.CSSProperties}>
          <InstallCard builds={builds} failed={failed} targets={targets} phone={phone} qr={qr} />
        </div>

        <div className="hero-intro rise" style={{ '--i': 3 } as React.CSSProperties}>
          <p className="hero-sub">
            Install MAYA once and every app your company builds is here, kept up
            to date. You only see the ones you are meant to have.
          </p>
          <div className="hero-actions">
            <ButtonLink variant="primary" to="/register">
              Create account
            </ButtonLink>
            <ButtonLink variant="ghost" to="/login">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </section>

      <StatsStrip />

      <section className="how" id="how">
        <div className="section-head">
          <h2>Installing MAYA takes three steps</h2>
          <p>
            Your phone will ask a couple of questions along the way. Here is what
            they mean, so you can say yes with confidence.
          </p>
        </div>
        <ol className="steps">
          <li>
            <span className="step-n">1</span>
            <h3>Download it on your phone</h3>
            <p>
              Your browser will warn you before saving the file. That warning
              appears for every app installed this way, so keep the file.
            </p>
          </li>
          <li>
            <span className="step-n">2</span>
            <h3>Say yes when your phone asks</h3>
            <p>
              Your phone asks permission the first time your browser installs an
              app. You are allowing that one browser, not everything.
            </p>
          </li>
          <li>
            <span className="step-n">3</span>
            <h3>Sign in with your work account</h3>
            <p>
              Your apps appear. An administrator chooses which ones, so the list
              is already right for your job.
            </p>
          </li>
        </ol>
      </section>

      <section className="publish" id="publish">
        <div>
          <h2>Built something? Publish it here.</h2>
          <p>
            If you make apps for this company, the console is where you upload a
            build, test it with a few people first, and release it when it is
            ready.
          </p>
        </div>
        <ButtonLink variant="primary" to="/login">
          Open the console
        </ButtonLink>
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
