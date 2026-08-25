import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, ApiError } from '../api'
import { isStaff, useAuth } from '../auth'
import { Empty, Failed, Loading } from '../ui/state'
import type { ManagedApp } from '../types'

/**
 * Deterministic icon colour per app.
 *
 * Deliberately LIGHT, because the initials drawn on them are near-black. The
 * first pass used saturated mid-tones and measured 3.9:1 on two of the six —
 * one app in three would have had unreadable initials. These clear 7.5:1 at
 * worst.
 */
const PALETTE = ['#FF9AAC', '#FFB088', '#F5CE55', '#7ED4A0', '#9CB8FF', '#D0A0EE']
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

type SortKey = 'name' | 'updated' | 'testers'

export const Catalog = () => {
  const { role } = useAuth()
  const [apps, setApps] = useState<ManagedApp[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState<'all' | 'android' | 'ios' | 'both'>('all')
  const [publisher, setPublisher] = useState('all')
  const [state, setState] = useState<'all' | 'published' | 'unpublished'>('all')
  const [sort, setSort] = useState<SortKey>('name')

  const load = useCallback(() => {
    setError(null)
    api
      .get<ManagedApp[]>('/manage/apps')
      .then(setApps)
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load the catalog'),
      )
  }, [])

  useEffect(load, [load])

  /* Built from the data rather than hardcoded: a team that publishes nothing
     should not sit in the filter forever, and a new one should appear without
     anybody editing a list. */
  const publishers = useMemo(
    () => [...new Set((apps ?? []).map((app) => app.publisher).filter(Boolean))].sort(),
    [apps],
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = (apps ?? []).filter((app) => {
      if (platform !== 'all' && app.platform !== platform) return false
      if (publisher !== 'all' && app.publisher !== publisher) return false
      if (state === 'published' && app.publishedCount === 0) return false
      if (state === 'unpublished' && app.publishedCount > 0) return false
      if (!needle) return true
      return (
        app.name.toLowerCase().includes(needle) ||
        app.slug.includes(needle) ||
        app.packageId.toLowerCase().includes(needle)
      )
    })

    return filtered.sort((a, b) => {
      if (sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
      if (sort === 'testers') return b.releaseCount - a.releaseCount
      return a.name.localeCompare(b.name)
    })
  }, [apps, query, platform, publisher, state, sort])

  const filtered = shown.length !== (apps?.length ?? 0)

  return (
    <>
      <div className="page-head rise">
        <div>
          <h1>Apps</h1>
          <p>
            Everything published to this organization. Builds on the internal and
            beta tracks are visible here because you can see them — ordinary
            members cannot.
          </p>
        </div>
        {/* Publisher and above: registering an app is the same authority as
            putting a build in it. A viewer sees the catalog without the door. */}
        {isStaff(role) && (
          <Link className="btn btn-primary" to="/apps/new">
            Add an app
          </Link>
        )}
      </div>

      {apps && apps.length > 0 && (
        <div className="filters rise" style={{ '--i': 1 } as React.CSSProperties}>
          <input
            className="filter-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, slug or package id"
            aria-label="Search apps"
          />
          <select
            value={platform}
            onChange={(event) => setPlatform(event.target.value as typeof platform)}
            aria-label="Filter by platform"
          >
            <option value="all">Any platform</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="both">Both</option>
          </select>
          <select
            value={state}
            onChange={(event) => setState(event.target.value as typeof state)}
            aria-label="Filter by release state"
          >
            <option value="all">Any state</option>
            <option value="published">Live to everyone</option>
            <option value="unpublished">Nothing published</option>
          </select>
          {publishers.length > 0 && (
            <select
              value={publisher}
              onChange={(event) => setPublisher(event.target.value)}
              aria-label="Filter by team"
            >
              <option value="all">Any team</option>
              {publishers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort"
          >
            <option value="name">A–Z</option>
            <option value="updated">Recently updated</option>
            <option value="testers">Most releases</option>
          </select>

          <span className="filter-count">
            {filtered ? `${shown.length} of ${apps.length}` : `${apps.length} apps`}
          </span>
        </div>
      )}

      {error && <Failed error={error} onRetry={load} />}
      {!error && !apps && <Loading label="Loading the catalog…" />}
      {!error && apps?.length === 0 && (
        <Empty
          title="No apps yet"
          body="Add an app to register it, then upload a build for it."
        />
      )}

      {apps && apps.length > 0 && shown.length === 0 && (
        <Empty
          title="Nothing matches"
          body="No app in this organization matches those filters."
        />
      )}

      {shown.length > 0 && (
        <div className="grid">
          {/* Rows arrive in sequence rather than all at once — the same
              staggered entrance the app's catalog uses, capped at 8 steps so a
              long list does not trail. */}
          {shown.map((app, index) => (
            <Link
              className="app-row rise"
              style={{ '--i': index + 1 } as React.CSSProperties}
              key={app.id}
              to={`/apps/${app.slug}`}
            >
              <span className="app-icon" style={{ background: colorFor(app.slug) }}>
                {initialsFor(app.name)}
              </span>
              <div>
                <h3>{app.name}</h3>
                <p className="muted">{app.tagline || app.description || '—'}</p>
              </div>
              <span className="app-meta">
                {app.platform}
                {app.latestVersion ? ` · v${app.latestVersion}` : ''}
                {/* Says what a device would see, which is the thing a publisher
                    is usually checking. An app with builds but none published
                    is invisible in the store and that should be obvious here. */}
                {app.publishedCount === 0 && (
                  <span className="pill pill-internal" style={{ marginLeft: '.5rem' }}>
                    unpublished
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
