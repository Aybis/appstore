import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, ApiError } from '../services/api'
import { isStaff, useAuth } from '../services/auth'
import { AppIcon, ButtonLink, Empty, Failed, Loading, PageHeader } from '../components'
import type { CatalogApp, ManagedApp } from '../types'

type SortKey = 'name' | 'updated' | 'testers'

/**
 * A viewer reads the same list a device does: `/manage/apps` is publisher and
 * above, while `/apps` already applies the member's app access and the tracks
 * their role may see. Reshaped so the page renders one kind of row.
 */
const fromCatalog = (app: CatalogApp): ManagedApp => ({
  id: app.id,
  slug: app.slug,
  name: app.name,
  tagline: app.tagline,
  description: app.description,
  category: app.category,
  publisher: app.publisher,
  platform: app.platform,
  packageId: app.packageId,
  iconUrl: '',
  featured: app.featured,
  releaseCount: 0,
  // Only apps with a release this viewer may install come back from /apps.
  publishedCount: 1,
  latestVersion: app.version,
  updatedAt: app.updatedAt,
})

const ViewerRow = ({ to: _to, ...rest }: React.ComponentProps<typeof Link>) => (
  <div className={rest.className} style={rest.style}>
    {rest.children as React.ReactNode}
  </div>
)

export const Catalog = () => {
  const { role } = useAuth()
  const [apps, setApps] = useState<ManagedApp[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState<'all' | 'android' | 'ios' | 'both'>('all')
  const [publisher, setPublisher] = useState('all')
  const [state, setState] = useState<'all' | 'published' | 'unpublished'>('all')
  const [sort, setSort] = useState<SortKey>('name')

  const staff = isStaff(role)
  const [denied, setDenied] = useState(false)

  const load = useCallback(() => {
    setError(null)
    setDenied(false)
    const request = staff
      ? api.get<ManagedApp[]>('/manage/apps')
      : api.get<CatalogApp[]>('/apps').then((rows) => rows.map(fromCatalog))
    request.then(setApps).catch((caught: unknown) => {
      // No access is an answer, not a failure: say so plainly instead of
      // offering a retry that will be refused the same way.
      if (caught instanceof ApiError && caught.status === 403) {
        setDenied(true)
        return
      }
      setError(caught instanceof ApiError ? caught.message : 'Could not load the catalog')
    })
  }, [staff])

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
  // The detail page is publisher and above, so a viewer's row goes nowhere.
  const Row = staff ? Link : ViewerRow

  return (
    <>
      <PageHeader
        title="Apps"
        description="Everything published to this organization. Builds on the internal and beta tracks are visible here because you can see them — ordinary members cannot."
      >
        {/* Publisher and above: registering an app is the same authority as
            putting a build in it. A viewer sees the catalog without the door. */}
        {staff && (
          <ButtonLink variant="primary" to="/apps/new">
            Add an app
          </ButtonLink>
        )}
      </PageHeader>

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
      {denied && (
        <Empty
          title="No apps for you yet"
          body="Your account has no access to apps in this organization. Ask an admin to grant it."
        />
      )}
      {!error && !denied && !apps && <Loading label="Loading the catalog…" />}
      {!error && apps?.length === 0 && (
        <Empty
          title="No apps yet"
          body={
            staff
              ? 'Add an app to register it, then upload a build for it.'
              : 'Nothing has been released to you yet. Apps appear here once a build is published to a track you can see.'
          }
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
            <Row
              className="app-row rise"
              style={{ '--i': index + 1 } as React.CSSProperties}
              key={app.id}
              to={`/apps/${app.slug}`}
            >
              <AppIcon seed={app.slug} name={app.name} />
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
            </Row>
          ))}
        </div>
      )}
    </>
  )
}
