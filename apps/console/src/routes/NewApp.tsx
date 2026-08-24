import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, ApiError } from '../api'
import { colorFor, initialsFor } from './Catalog'

/** Same shape the API's appSlugSchema accepts, derived so nobody has to type it. */
const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

const errorText = (caught: unknown, fallback: string): string =>
  caught instanceof ApiError ? caught.message : fallback

/**
 * Registering an app.
 *
 * An app exists before any build of it does — that is the point of registering
 * one. The package id in particular is a property of the product rather than
 * of a binary, and setting it here is what lets a device answer "do I already
 * have this?" before the first release is ever uploaded.
 *
 * Release notes are deliberately NOT on this form. They describe what changed
 * in a build, so they belong to the build, and they are asked for on the
 * upload step instead. Putting them here would mean writing them once and
 * having them go stale from the second release onward.
 */
export const NewApp = () => {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [packageId, setPackageId] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [publisher, setPublisher] = useState('')
  const [platform, setPlatform] = useState<'android' | 'ios' | 'both'>('android')
  const [icon, setIcon] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The slug follows the name until somebody edits it, then it is theirs.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  // Object URLs are a leak if the file changes and the old one is never freed.
  useEffect(() => {
    if (!icon) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(icon)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [icon])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setFailure(null)
    try {
      const form = new FormData()
      form.append('slug', slug)
      form.append('name', name)
      form.append('packageId', packageId)
      form.append('platform', platform)
      form.append('tagline', tagline)
      form.append('description', description)
      form.append('category', category || 'uncategorized')
      form.append('publisher', publisher)
      if (icon) form.append('icon', icon)

      await api.upload<{ slug: string }>('/apps', form)
      // Straight to the app's page, which is where the next thing — uploading
      // a build — actually happens.
      navigate(`/apps/${slug}`)
    } catch (caught) {
      setFailure(errorText(caught, 'Could not create that app'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head rise">
        <div>
          <Link to="/apps" className="back-link">
            ← All apps
          </Link>
          <h1>Add an app</h1>
          <p>
            Register the product first; builds come afterwards. What changed in
            a particular build is written when you upload it, not here.
          </p>
        </div>
      </div>

      <form className="section rise" style={{ '--i': 1 } as React.CSSProperties} onSubmit={(event) => void submit(event)}>
        <div className="new-app">
          <div className="new-app-icon">
            <label htmlFor="app-icon" className="icon-drop">
              {preview ? (
                <img src={preview} alt="" className="icon-preview" />
              ) : (
                <span
                  className="icon-preview icon-generated"
                  style={{ background: colorFor(slug || 'app') }}
                >
                  {initialsFor(name || '?')}
                </span>
              )}
              <span className="icon-drop-hint">
                {icon ? 'Change icon' : 'Add an icon'}
              </span>
            </label>
            <input
              id="app-icon"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              onChange={(event) => setIcon(event.target.files?.[0] ?? null)}
            />
            {/* Says what happens without one, rather than implying it is required. */}
            <p className="icon-note">
              PNG, JPEG or WebP, up to 1 MB. Without one, MAYA draws the
              initials on a colour derived from the slug — which is what you
              see here.
            </p>
          </div>

          <div className="new-app-fields">
            <label className="field">
              <span>Name</span>
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Field Scanner"
              />
            </label>

            <label className="field">
              <span>Sub name</span>
              <input
                maxLength={200}
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Barcode and asset scanning for site teams"
              />
              <small className="field-hint">One line, shown under the name in the catalog.</small>
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Package ID</span>
                <input
                  value={packageId}
                  onChange={(event) => setPackageId(event.target.value)}
                  placeholder="com.company.fieldscanner"
                  className="mono"
                />
                <small className="field-hint">
                  How a device recognises this app. Set it now and MAYA can tell
                  whether somebody already has it, before the first build exists.
                </small>
              </label>

              <label className="field">
                <span>Platform</span>
                <select
                  value={platform}
                  onChange={(event) =>
                    setPlatform(event.target.value as 'android' | 'ios' | 'both')
                  }
                >
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="both">Both</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Description</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What the app is for, and who it is for."
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Category</span>
                <input
                  maxLength={60}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Tools"
                />
              </label>

              <label className="field">
                <span>Team</span>
                <input
                  maxLength={120}
                  value={publisher}
                  onChange={(event) => setPublisher(event.target.value)}
                  placeholder="Field Operations"
                />
              </label>
            </div>

            <label className="field">
              <span>URL name</span>
              <input
                required
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value)
                }}
                className="mono"
              />
              <small className="field-hint">
                Follows the name until you change it. Used in links and cannot
                be edited later without breaking them.
              </small>
            </label>

            {failure && <p className="err-msg">{failure}</p>}

            <div className="new-app-actions">
              <button className="btn btn-primary" type="submit" disabled={busy || !name || !slug}>
                {busy ? 'Creating…' : 'Create app'}
              </button>
              <Link className="btn btn-ghost" to="/apps">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </form>
    </>
  )
}
