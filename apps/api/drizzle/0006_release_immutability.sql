-- "Publishes an immutable release" is in the v1 Definition of Done, but nothing
-- enforced it: a published row's version or binding could be edited in place,
-- which is exactly the case a store must not allow — devices have already
-- installed what that row described.
--
-- Enforced in the database rather than the service layer, for the same reason
-- RLS is: a second writer (a script, a migration, a future admin endpoint)
-- must not be able to bypass it by not calling the right service method.
--
-- The marker is deliberately never spelled out in this file; drizzle-orm splits
-- the raw text on it with no comment awareness.

CREATE OR REPLACE FUNCTION releases_reject_mutation_when_published()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF OLD.status <> 'published' THEN
    RETURN NEW;
  END IF;

  -- Identity is frozen. status may still change (published -> unpublished is a
  -- supported operation: it withdraws a build from the catalog without
  -- pretending the artifact was never distributed), and so may release_notes,
  -- which is prose about the build rather than the build itself.
  IF NEW.app_id     IS DISTINCT FROM OLD.app_id
  OR NEW.platform   IS DISTINCT FROM OLD.platform
  OR NEW.version    IS DISTINCT FROM OLD.version
  OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION
      'release % is published and immutable: app_id, platform, version and published_at cannot change',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER releases_immutable_when_published
  BEFORE UPDATE ON releases
  FOR EACH ROW
  EXECUTE FUNCTION releases_reject_mutation_when_published();

-- An artifact is the binary a published release points at. Repointing or
-- deleting it would silently change what a published version means.
CREATE OR REPLACE FUNCTION artifacts_reject_mutation_when_published()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  parent_status release_status;
BEGIN
  SELECT status INTO parent_status
  FROM releases
  WHERE id = COALESCE(NEW.release_id, OLD.release_id);

  IF parent_status = 'published' THEN
    RAISE EXCEPTION
      'artifact % belongs to a published release and is immutable',
      COALESCE(NEW.id, OLD.id)
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

CREATE TRIGGER artifacts_immutable_when_release_published
  BEFORE UPDATE OR DELETE ON artifacts
  FOR EACH ROW
  EXECUTE FUNCTION artifacts_reject_mutation_when_published();
