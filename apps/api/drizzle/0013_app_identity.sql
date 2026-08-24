-- An app's own identity: its package id and its icon.
--
-- PACKAGE ID was only ever on `artifacts`, set from whatever binary was last
-- uploaded. That is backwards. A bundle identifier is a property of the APP —
-- it is fixed for the life of the product, it is what the device matches
-- against to decide whether the app is already installed, and it exists before
-- any build does. Deriving it from the newest artifact means a brand new app
-- has no package id at all (catalog.service.ts returns '' for exactly that
-- case), so install detection cannot work until somebody uploads something.
--
-- Keeping BOTH is deliberate. The artifact's package id is what was actually
-- inside the binary; the app's is what it is supposed to be. Publishing can
-- now compare them, and an APK whose package id does not match the app it is
-- being uploaded to is almost always the wrong file — a mistake that currently
-- succeeds and then silently breaks install detection for everybody.
--
-- ICON: there was no icon anywhere. The console draws initials on a generated
-- colour, which is a decent fallback and a poor identity. `icon_key` points
-- into the content-addressed store, so two apps uploading the same image share
-- one object and an icon URL never has to be signed — the digest IS the
-- capability, and it discloses nothing about org or app.
--
-- As with 0002-0012, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
ALTER TABLE "apps" ADD COLUMN "package_id" text DEFAULT '' NOT NULL;

ALTER TABLE "apps" ADD COLUMN "icon_key" text DEFAULT '' NOT NULL;

-- Backfill from the newest artifact of each app, so existing apps keep the
-- package id install detection is already using rather than starting empty.
UPDATE apps a
SET package_id = COALESCE((
  SELECT f.package_id
  FROM artifacts f
  JOIN releases r ON r.id = f.release_id
  WHERE r.app_id = a.id AND f.package_id <> ''
  ORDER BY r.updated_at DESC
  LIMIT 1
), '');

-- One package id per platform per org: two apps claiming the same identifier
-- would make "is this installed?" ambiguous, and the answer would depend on
-- which row was read first. Empty is exempt — an app with no build yet has
-- nothing to clash over, and there may be many of those.
CREATE UNIQUE INDEX "apps_org_package_key"
  ON apps (org_id, platform, package_id)
  WHERE package_id <> '';
