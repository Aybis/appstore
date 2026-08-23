-- Release tracks and beta testers.
--
-- The gap this closes: every published release went live to the whole
-- organization the moment it was published. There was no way to put a build
-- somewhere QA could smoke-test it without also announcing it to everyone, and
-- no way to hand a build to a handful of named testers before a public release.
--
-- Three tracks, promoted left to right. A release is IMMUTABLE in every respect
-- that identifies it (migration 0006 freezes app_id, platform, version and
-- published_at on a published row) — `track` is deliberately not in that set,
-- because promotion has to be possible without producing a new build. The build
-- that QA smoke-tested is the build that reaches production; re-uploading it
-- would defeat the point of testing it.
--
-- As with 0002-0007, the statement-breakpoint marker is deliberately never
-- spelled out in this file: drizzle-orm splits the raw text on it with no
-- comment awareness.
CREATE TYPE "release_track" AS ENUM ('internal', 'beta', 'production');

-- Default 'internal', deliberately. A build must never become public because
-- someone forgot to pass a field — the safe state is the private one, and
-- reaching production is an explicit act.
ALTER TABLE "releases" ADD COLUMN "track" "release_track" DEFAULT 'internal' NOT NULL;

-- Everything already published predates tracks and is, by definition, live.
UPDATE "releases" SET "track" = 'production' WHERE "status" = 'published';

CREATE INDEX "releases_org_track_idx" ON "releases" ("org_id","track");

-- Who may see a non-production track for one app.
--
-- Per-app rather than per-org: being a beta tester for the expense app is not a
-- reason to see unreleased HR builds. Staff (publisher/admin/owner) do not need
-- rows here — their role already grants internal and beta visibility, and
-- enrolling every publisher as a tester of every app would make this table
-- meaningless.
CREATE TABLE "app_testers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "app_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "track" "release_track" DEFAULT 'beta' NOT NULL,
  "invited_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "app_testers" ADD CONSTRAINT "app_testers_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "app_testers" ADD CONSTRAINT "app_testers_app_id_apps_id_fk"
  FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "app_testers" ADD CONSTRAINT "app_testers_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
-- Removing the inviter must not remove the enrolment.
ALTER TABLE "app_testers" ADD CONSTRAINT "app_testers_invited_by_users_id_fk"
  FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- One enrolment per person per app; re-inviting moves their track instead of
-- creating a second row that would make visibility depend on row order.
CREATE UNIQUE INDEX "app_testers_app_user_key" ON "app_testers" ("app_id","user_id");
CREATE INDEX "app_testers_org_user_idx" ON "app_testers" ("org_id","user_id");

-- Carries org_id, so rls-invariants.spec.ts requires row security ENABLEd,
-- FORCEd and policed. NULLIF for the same reason as 0002: an unwound LOCAL
-- setting reads back as '' rather than NULL, and ''::uuid raises 22P02 instead
-- of denying.
ALTER TABLE app_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_testers FORCE ROW LEVEL SECURITY;

CREATE POLICY app_testers_tenant_isolation ON app_testers
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
