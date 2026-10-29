import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, ApiError } from '../services/api'
import { Button, ButtonLink, colorFor, Field, initialsFor, Message, PageHeader } from '../components'
import { ICON_SIZE, prepareIcon, type PreparedIcon } from '../utils/icon-image'

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
  const [minimumVersion, setMinimumVersion] = useState('')
  const [icon, setIcon] = useState<File | null>(null)
  const [iconInfo, setIconInfo] = useState<PreparedIcon | null>(null)
  const [iconError, setIconError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  /*
   * Optional first build, attached while registering.
   *
   * An app that is "both" gets two slots, because an APK and an IPA are two
   * different binaries of the same product and there is no single file that
   * covers them. Uploading one and coming back for the other is the workflow
   * that produces half-published apps.
   */
  const [apk, setApk] = useState<File | null>(null)
  const [ipa, setIpa] = useState<File | null>(null)
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<string | null>(null)
  const [collision, setCollision] = useState<{
    name: string
    seller: string
    url: string
  } | null>(null)

  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // The slug follows the name until somebody edits it, then it is theirs.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  /*
   * Asks the App Store whether this bundle id is already taken — DEBOUNCED,
   * because unlike the console's other filters this is a real network call and
   * firing one per keystroke would send a request for every prefix of
   * "com.company.fieldscanner".
   *
   * Advisory only. A match is worth knowing and is not necessarily wrong: an
   * internal store legitimately hosts a company's own build of an app that
   * also exists publicly. And the check is blind to Google Play — see
   * package-lookup.service.ts — so a silent result proves nothing.
   */
  useEffect(() => {
    const candidate = packageId.trim()
    if (!candidate.includes('.')) {
      setCollision(null)
      return
    }

    const timer = setTimeout(() => {
      void api
        .get<{ match: { name: string; seller: string; url: string } | null }>(
          `/manage/apps/package-check/${encodeURIComponent(candidate)}`,
        )
        .then((result) => setCollision(result.match))
        .catch(() => setCollision(null))
    }, 500)

    return () => clearTimeout(timer)
  }, [packageId])

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
      form.append('minimumVersion', minimumVersion)
      if (icon) form.append('icon', icon)

      setStep('Registering the app…')
      await api.upload<{ slug: string }>('/apps', form)

      /*
       * Builds go up AFTER the app exists, one request each, because a release
       * belongs to an app and the server has to have the app to attach it to.
       * Sequential rather than parallel: two 100 MB uploads at once on office
       * wifi is slower than one after the other, and a failure part-way is far
       * easier to describe.
       */
      const builds: { file: File; platform: 'android' | 'ios' }[] = [
        ...(apk ? [{ file: apk, platform: 'android' as const }] : []),
        ...(ipa ? [{ file: ipa, platform: 'ios' as const }] : []),
      ]

      for (const build of builds) {
        setStep(`Uploading the ${build.platform === 'android' ? 'APK' : 'IPA'}…`)
        const release = new FormData()
        release.append('file', build.file)
        release.append('version', version)
        release.append('platform', build.platform)
        release.append('packageId', packageId)
        release.append('releaseNotes', notes)
        // Development, always. A build has never been smoke-tested at the
        // moment it is first uploaded, and defaulting anywhere else would put
        // an untested binary in front of people.
        release.append('track', 'internal')
        await api.upload(`/apps/${slug}/releases`, release)
      }

      navigate(`/apps/${slug}`)
    } catch (caught) {
      setFailure(errorText(caught, 'Could not create that app'))
    } finally {
      setBusy(false)
      setStep(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Add an app"
        back={{ to: '/apps', label: 'All apps' }}
        description="Register the product first; builds come afterwards. What changed in a particular build is written when you upload it, not here."
      />

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
              onChange={(event) => {
                const chosen = event.target.files?.[0] ?? null
                setIconError(null)
                if (!chosen) {
                  setIcon(null)
                  setIconInfo(null)
                  return
                }
                // Squared, resized and re-encoded before it ever leaves the
                // page — see icon-image.ts for why that happens here.
                void prepareIcon(chosen)
                  .then((prepared) => {
                    setIcon(prepared.file)
                    setIconInfo(prepared)
                  })
                  .catch((caught: unknown) => {
                    setIcon(null)
                    setIconInfo(null)
                    setIconError(
                      caught instanceof Error ? caught.message : 'Could not read that image',
                    )
                  })
              }}
            />
            {/* Says what happens without one, rather than implying it is required. */}
            {iconInfo ? (
              <p className="icon-note">
                Resized to {ICON_SIZE}×{ICON_SIZE},{' '}
                {(iconInfo.bytes / 1024).toFixed(0)} KB
                {iconInfo.cropped && ' — the middle was taken, since it was not square'}.
              </p>
            ) : (
              <p className="icon-note">
                Any square-ish PNG, JPEG or WebP. It is cropped to a square and
                resized to {ICON_SIZE}×{ICON_SIZE} here, before uploading —
                the size both stores converge on. Without one, MAYA draws the
                initials on a colour derived from the slug.
              </p>
            )}
            {iconError && <Message tone="error">{iconError}</Message>}
          </div>

          <div className="new-app-fields">
            <Field label="Name">
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Field Scanner"
              />
            </Field>

            <Field label="Sub name" hint="One line, shown under the name in the catalog.">
              <input
                maxLength={200}
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Barcode and asset scanning for site teams"
              />
            </Field>

            <div className="form-grid">
              <Field label="Package ID">
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
                {collision && (
                  <small className="field-note">
                    <strong>{collision.name}</strong> by {collision.seller} already
                    uses this on the App Store. That is fine if it is yours —
                    this is a note, not a problem. (Google Play cannot be checked
                    this way, so a quiet result here proves nothing.)
                  </small>
                )}
              </Field>

              <Field label="Platform">
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
              </Field>
            </div>

            <Field label="Description">
              <textarea
                rows={4}
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What the app is for, and who it is for."
              />
            </Field>

            <Field label="Minimum version" hint="Optional. The oldest build still allowed to run — anyone below it is forced to update with no way to dismiss it. Leave empty to never force. Three or four parts both work; versions are compared numerically, so 1.10 is above 1.9.">
              <input
                value={minimumVersion}
                onChange={(event) => setMinimumVersion(event.target.value)}
                placeholder="1.4.0"
                className="mono"
                inputMode="decimal"
              />
            </Field>

            <div className="form-grid">
              <Field label="Category">
                <input
                  maxLength={60}
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Tools"
                />
              </Field>

              <Field label="Team">
                <input
                  maxLength={120}
                  value={publisher}
                  onChange={(event) => setPublisher(event.target.value)}
                  placeholder="Field Operations"
                />
              </Field>
            </div>

            <Field label="URL name" hint="Follows the name until you change it. Used in links and cannot be edited later without breaking them.">
              <input
                required
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value)
                }}
                className="mono"
              />
            </Field>

            <fieldset className="build-slots">
              <legend>First build — optional</legend>
              <p className="field-hint" style={{ marginBottom: 'var(--s-3)' }}>
                Attach one now, or register the app and upload later. Anything
                added here lands on Development, where nobody is notified.
              </p>

              <div className="form-grid">
                {(platform === 'android' || platform === 'both') && (
                  <Field label="Android build (.apk)">
                    <input
                      type="file"
                      accept=".apk,application/vnd.android.package-archive"
                      onChange={(event) => setApk(event.target.files?.[0] ?? null)}
                    />
                  </Field>
                )}
                {(platform === 'ios' || platform === 'both') && (
                  <Field label="iOS build (.ipa)">
                    <input
                      type="file"
                      accept=".ipa"
                      onChange={(event) => setIpa(event.target.files?.[0] ?? null)}
                    />
                  </Field>
                )}
              </div>

              {(apk || ipa) && (
                <div className="form-grid" style={{ marginTop: 'var(--s-3)' }}>
                  <Field label="Version" hint="Both builds get this version — they are the same release of the same product.">
                    <input
                      required
                      value={version}
                      onChange={(event) => setVersion(event.target.value)}
                      placeholder="1.0.0"
                      className="mono"
                    />
                  </Field>
                  <Field label="What changed">
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="First build."
                    />
                  </Field>
                </div>
              )}
            </fieldset>

            {failure && <Message tone="error">{failure}</Message>}

            <div className="new-app-actions">
              <Button variant="primary"
                type="submit"
                disabled={busy || !name || !slug || (Boolean(apk || ipa) && !version)}
              >
                {busy ? (step ?? 'Creating…') : 'Create app'}
              </Button>
              <ButtonLink variant="ghost" to="/apps">
                Cancel
              </ButtonLink>
            </div>
          </div>
        </div>
      </form>
    </>
  )
}
