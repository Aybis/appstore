-- A published build's FILE may move; what the release means may not.
--
-- 0006 froze every column of an artifact once its release is published, so a
-- version can never be repointed at different bytes. That is still the rule.
-- But storage_key is not what the release means: it is only where the bytes
-- sit in the bucket, and the content is pinned by sha256. Freezing it as well
-- made it impossible to reorganize the bucket (storage:tidy moves files into
-- the readable <org>/<app>/<platform>/ layout) without rewriting history.
--
-- So an UPDATE that changes storage_key and nothing else is allowed. Any other
-- change, and any DELETE, is refused exactly as before.
--
-- As with 0002-0015, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
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
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'storage_key') = (to_jsonb(OLD) - 'storage_key') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'artifact % belongs to a published release and is immutable',
      COALESCE(NEW.id, OLD.id)
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;
