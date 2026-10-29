import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { config } from '../config'
import { AppIcon, Button, ButtonLink, MayaMark } from '../components'
import './landing.css'

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
      <div className="landing-glow" aria-hidden="true" />

      <header className="landing-nav">
        <div className="landing-nav-bar">
          <Link className="brand landing-brand" to="/">
            <MayaMark size={28} />
            <span className="brand-name">MAYA</span>
          </Link>
          <Link className="nav-cta" to="/login">
            Open console
          </Link>
        </div>
      </header>

      <section className="hero" style={{ paddingBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '1.6rem' }}>
          <AppIcon seed={slug} name={slug.replace(/-/g, ' ')} size="4.5rem" style={{ fontSize: '1.4rem' }} />
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
          <Button variant="primary" onClick={openInApp}>
            Open in MAYA
          </Button>
          <ButtonLink variant="ghost" to="/login">
            Sign in to the console
          </ButtonLink>
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
