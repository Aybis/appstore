import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { config } from '../config'
import { MayaMark } from '../ui/MayaMark'
import { colorFor, initialsFor } from './Catalog'
import './landing.css'
import '../ui/ui.css'

/**
 * Where an install link lands when the app is not installed.
 *
 * This is the entire argument for `https://` App Links over the `maya://`
 * scheme: a custom scheme handed to someone without the app does nothing at
 * all — no error, no page, no hint. The same https link opens MAYA when it is
 * present and lands here when it is not.
 *
 * Deliberately unauthenticated and deliberately thin. The catalog is tenant
 * data behind a session, so this page cannot show a version, a size or a
 * download; it shows the slug the link asked for, explains what MAYA is, and
 * routes to the console. Anything more would either leak the catalog or lie.
 */
export const PublicApp = () => {
  const { slug = '' } = useParams()
  const [opened, setOpened] = useState(false)

  // Try the app first. If MAYA is installed it handles the App Link before this
  // page ever renders; this covers the case where the user arrived here anyway
  // — a desktop browser, or an in-app webview that swallowed the intent.
  const openInApp = useCallback(() => {
    setOpened(true)
    window.location.href = `maya://app/${slug}`
  }, [slug])

  useEffect(() => {
    document.title = `${slug} — MAYA`
  }, [slug])

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link className="brand" to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <MayaMark size={30} />
          <span className="brand-name">MAYA</span>
        </Link>
        <nav className="landing-nav-links">
          <Link className="nav-cta" to="/login">
            Open console
          </Link>
        </nav>
      </header>

      <section className="hero" style={{ paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '1.6rem' }}>
          <span
            className="app-icon"
            style={{ background: colorFor(slug), width: '4.5rem', height: '4.5rem', fontSize: '1.4rem' }}
          >
            {initialsFor(slug.replace(/-/g, ' '))}
          </span>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Internal app</p>
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', margin: '.2rem 0 0' }}>
              {slug.replace(/-/g, ' ')}
            </h1>
          </div>
        </div>

        <p className="hero-sub">
          This app is distributed privately through MAYA, your organization's
          internal store. Install MAYA and sign in with your company account to
          get it — it is not available from any public app store.
        </p>

        <div className="hero-actions">
          <button className="btn btn-primary" onClick={openInApp}>
            Open in MAYA
          </button>
          <Link className="btn btn-ghost" to="/login">
            Sign in to the console
          </Link>
        </div>

        {opened && (
          <p className="hero-note">
            Nothing happened? MAYA is probably not installed on this device — ask
            your platform team for the install link.
          </p>
        )}
      </section>

      <footer className="landing-foot">
        <div className="brand">
          <MayaMark size={22} />
          <span className="brand-name">MAYA</span>
        </div>
        <p>Internal distribution for {new URL(config.siteUrl).hostname}.</p>
      </footer>
    </div>
  )
}
