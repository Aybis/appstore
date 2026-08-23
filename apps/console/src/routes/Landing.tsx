import { Link } from 'react-router-dom'

import { config } from '../config'
import { MayaMark } from '../ui/MayaMark'
import './landing.css'

/**
 * The public face of the store, and — deliberately — the fallback target for
 * every deep link.
 *
 * An `https://` App Link opens the app when it is installed and lands here when
 * it is not. That is the whole reason to prefer a real domain over the `maya://`
 * scheme: a custom scheme handed to somebody without the app installed does
 * nothing at all, which is the worst possible outcome for an install link.
 */
export const Landing = () => (
  <div className="landing">
    <header className="landing-nav">
      <div className="brand">
        <MayaMark size={30} />
        <span className="brand-name">MAYA</span>
      </div>
      <nav className="landing-nav-links">
        <a href="#how">How it works</a>
        <a href="#tracks">Release tracks</a>
        <Link className="nav-cta" to="/login">
          Open console
        </Link>
      </nav>
    </header>

    <section className="hero">
      <p className="eyebrow">Internal app distribution</p>
      <h1>
        Ship your own apps
        <br />
        to your own people.
      </h1>
      <p className="hero-sub">
        MAYA is a private catalog for the Android and iOS builds your company
        writes. Upload a build, let QA smoke-test it, hand it to a few beta
        testers, then release it — without any of it touching a public store.
      </p>
      <div className="hero-actions">
        <Link className="btn btn-primary" to="/login">
          Open the console
        </Link>
        <a className="btn btn-ghost" href="#how">
          See how it works
        </a>
      </div>
      <p className="hero-note">
        Self-hosted. Your binaries stay on your infrastructure.
      </p>
    </section>

    <section className="panel" id="how">
      <h2>From a build to a device</h2>
      <ol className="steps">
        <li>
          <span className="step-n">1</span>
          <div>
            <h3>Upload</h3>
            <p>
              A publisher pushes an APK or IPA from the console or from CI. The
              digest is computed from the bytes the server received, never from
              what the client claimed.
            </p>
          </div>
        </li>
        <li>
          <span className="step-n">2</span>
          <div>
            <h3>Smoke-test</h3>
            <p>
              The build lands on the <code>internal</code> track: installable by
              your team, invisible to everyone else, and announced to nobody.
            </p>
          </div>
        </li>
        <li>
          <span className="step-n">3</span>
          <div>
            <h3>Beta</h3>
            <p>
              Promote it to <code>beta</code> and name the testers who should
              see it. They get it; the rest of the company does not.
            </p>
          </div>
        </li>
        <li>
          <span className="step-n">4</span>
          <div>
            <h3>Release</h3>
            <p>
              Promote to <code>production</code>. The same binary your QA
              approved is the one that ships — promotion never rebuilds.
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section className="panel" id="tracks">
      <h2>Three tracks, one build</h2>
      <div className="tracks">
        <article className="track">
          <span className="pill pill-internal">internal</span>
          <h3>Staff only</h3>
          <p>
            Where every upload lands by default. A build is never public because
            a field was omitted.
          </p>
        </article>
        <article className="track">
          <span className="pill pill-beta">beta</span>
          <h3>Named testers</h3>
          <p>
            Enrolled per app, so testing the expense app is not a reason to see
            unreleased HR builds.
          </p>
        </article>
        <article className="track">
          <span className="pill pill-production">production</span>
          <h3>Everyone</h3>
          <p>
            The only track a distributed app is told about, so nothing
            unreleased ever prompts an update.
          </p>
        </article>
      </div>
    </section>

    <section className="panel">
      <h2>Updates that mean something</h2>
      <div className="update-demo">
        <div className="update-card update-major">
          <span className="pill pill-danger">major</span>
          <p className="update-versions">
            <span>1.0.0</span> <span className="arrow">→</span>{' '}
            <strong>1.1.0</strong>
          </p>
          <p>
            A change in the first or second digit cannot be dismissed. No cancel
            button, and the back button will not close it.
          </p>
        </div>
        <div className="update-card">
          <span className="pill pill-beta">minor</span>
          <p className="update-versions">
            <span>1.0.0</span> <span className="arrow">→</span>{' '}
            <strong>1.0.1</strong>
          </p>
          <p>
            A change in the last digit alone is offered, not forced. People can
            keep working and take it later.
          </p>
        </div>
      </div>
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
