-- Attribution for actions taken by a machine.
--
-- `releases.created_by` and `audit_events.actor_id` both reference `users`,
-- which was true of every actor until API keys existed. A build pushed by CI
-- has no user to point at: its subject is a key id, and the insert fails with
-- a foreign key violation — 23503, "Key is not present in table users".
--
-- Two different answers, because the two columns mean different things.
--
-- `releases` gets a PARALLEL column. "Who published this?" is a question the
-- console answers on every release row, and replacing a name with a blank for
-- every CI build would lose exactly the attribution that makes automated
-- publishing auditable. Exactly one of the two is set.
--
-- `audit_events` gets nothing. Its `actor_id` stays null for machine actors
-- and the key is recorded in `metadata`, because that table is already the
-- system of record for who did what, its metadata is deliberately schemaless,
-- and it is append-only — so a new column would be a migration against
-- history rather than a place to put new facts.
--
-- As with 0002-0011, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
ALTER TABLE "releases" ADD COLUMN "created_by_api_key" uuid;

-- SET NULL rather than CASCADE: revoking and deleting a key must never delete
-- the releases it published.
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_api_key_fk"
  FOREIGN KEY ("created_by_api_key") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;

-- A release has one author, not two. Both null is allowed: the creating user
-- may have been deleted, which is what ON DELETE SET NULL on created_by does.
ALTER TABLE "releases" ADD CONSTRAINT "releases_one_author"
  CHECK (NOT ("created_by" IS NOT NULL AND "created_by_api_key" IS NOT NULL));
