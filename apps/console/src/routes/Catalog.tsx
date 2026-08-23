import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, ApiError } from '../api'
import { Empty, Failed, Loading } from '../ui/state'
import type { CatalogApp } from '../types'
import '../ui/ui.css'

/** Deterministic icon colour per app, matching the mobile placeholder. */
const PALETTE = ['#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4']
export const colorFor = (seed: string): string => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}
export const initialsFor = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

export const Catalog = () => {
  const [apps, setApps] = useState<CatalogApp[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    api
      .get<CatalogApp[]>('/apps')
      .then(setApps)
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load the catalog'),
      )
  }, [])

  useEffect(load, [load])

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Apps</h1>
          <p>
            Everything published to this organization. Builds on the internal and
            beta tracks are visible here because you can see them — ordinary
            members cannot.
          </p>
        </div>
      </div>

      {error && <Failed error={error} onRetry={load} />}
      {!error && !apps && <Loading label="Loading the catalog…" />}
      {!error && apps?.length === 0 && (
        <Empty
          title="No apps yet"
          body="Publish a build through the API or CI and it will appear here."
        />
      )}

      {apps && apps.length > 0 && (
        <div className="grid">
          {apps.map((app) => (
            <Link className="app-row" key={app.id} to={`/apps/${app.slug}`}>
              <span className="app-icon" style={{ background: colorFor(app.slug) }}>
                {initialsFor(app.name)}
              </span>
              <div>
                <h3>{app.name}</h3>
                <p className="muted">{app.tagline || app.description || '—'}</p>
              </div>
              <span className="app-meta">
                {app.platform} · v{app.version} · {formatBytes(app.size)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
