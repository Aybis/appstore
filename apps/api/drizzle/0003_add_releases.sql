-- Plan 02 (distribution), data layer: a publishable version of an app, and the
-- binary behind it.
--
-- As with 0002, the statement-breakpoint marker is deliberately never spelled
-- out in this file, not even inside a comment: drizzle-orm's readMigrationFiles()
-- runs a plain String.split() over the whole file with no comment awareness, so
-- an occurrence in prose splits the migration exactly as a real one would.
CREATE TYPE "release_status" AS ENUM ('draft', 'published', 'unpublished');

CREATE TABLE "releases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "app_id" uuid NOT NULL,
  "platform" "app_platform" NOT NULL,
  "version" text NOT NULL,
  "build_number" text,
  "min_os" text DEFAULT '' NOT NULL,
  "release_notes" text DEFAULT '' NOT NULL,
  "status" "release_status" DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "release_id" uuid NOT NULL,
  "package_id" text NOT NULL,
  "storage_key" text NOT NULL,
  "sha256" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "content_type" text NOT NULL,
  "original_filename" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "releases" ADD CONSTRAINT "releases_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "releases" ADD CONSTRAINT "releases_app_id_apps_id_fk"
  FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "releases" ADD CONSTRAINT "releases_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_release_id_releases_id_fk"
  FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "releases_app_platform_version_key" ON "releases" ("app_id","platform","version");
CREATE INDEX "releases_org_app_idx" ON "releases" ("org_id","app_id");

-- Content addressing is per-tenant: two orgs may hold an identical binary and
-- neither may probe for the other's copy.
CREATE UNIQUE INDEX "artifacts_org_sha256_key" ON "artifacts" ("org_id","sha256");
CREATE INDEX "artifacts_release_idx" ON "artifacts" ("release_id");

-- Both tables carry org_id, so rls-invariants.spec.ts requires row security
-- ENABLEd, FORCEd, and policed on each. FORCE is what makes it real: without it
-- the table owner bypasses every policy and the tests pass while production leaks.
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases FORCE ROW LEVEL SECURITY;

-- NULLIF for the same reason as 0002: once set_config has run on a backend,
-- unwinding the LOCAL setting at COMMIT leaves the GUC as '' rather than NULL,
-- and ''::uuid raises 22P02 instead of denying. A policy that throws is not a
-- policy that denies.
CREATE POLICY releases_tenant_isolation ON releases
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts FORCE ROW LEVEL SECURITY;

CREATE POLICY artifacts_tenant_isolation ON artifacts
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
