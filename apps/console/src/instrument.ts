import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router-dom'

/*
 * A DSN only says where to send events — the browser can read it in any build —
 * so the production one lives here and Vercel needs no variable for it. Dev
 * builds send nothing unless VITE_SENTRY_DSN is set, so a local session does
 * not file issues against production.
 */
const PRODUCTION_DSN =
  'https://1b4f07f1fe69388ae593cbf0b2ee4eab@o4509801270411264.ingest.us.sentry.io/4512334727806976'

const env = import.meta.env
const dsn = (env.VITE_SENTRY_DSN as string | undefined) || (env.PROD ? PRODUCTION_DSN : undefined)

if (dsn) {
  Sentry.init({
    dsn,
    environment: (env.VITE_SENTRY_ENVIRONMENT as string | undefined) || env.MODE,
    integrations: [
      // Names transactions after the route pattern (/apps/:slug) rather than
      // the URL, so every app's detail page groups into one.
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: 1.0,
    // Same-origin API calls (/v1 through the Vercel rewrite) carry the trace
    // header, so a slow page links to the API request, its queries and its R2
    // calls in one trace. Nothing is sent to other origins.
    tracePropagationTargets: [/^\/v1\//, window.location.origin],
    // Login and register post passwords; the API answers with access tokens.
    dataCollection: { httpBodies: [], cookies: false },
  })
}
