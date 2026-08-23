-- Plan 01, Task 13: the append-only audit log.
--
-- "Every privileged action audited" has been in the goal statement since the
-- plan was written and in the v1 Definition of Done since the overview — and
-- nothing recorded anything. A store whose publish path leaves no trace cannot
-- answer the only question that matters after a bad build ships: who put it
-- there, and when.
--
-- As with 0002-0006, the statement-breakpoint marker is deliberately never
-- spelled out in this file, not even inside a comment: drizzle-orm's
-- readMigrationFiles() runs a plain String.split() over the whole file with no
-- comment awareness, so an occurrence in prose splits the migration exactly as
-- a real one would.
CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "actor_id" uuid,
  "action" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- actor_id is nullable and ON DELETE SET NULL rather than CASCADE: removing a
-- user must not erase the record of what they did. The event survives them,
-- with the actor reading as unknown.
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- The only read pattern is "this org's events, newest first", so the index
-- carries the sort column rather than leaving it to a top-N sort.
CREATE INDEX "audit_events_org_created_idx" ON "audit_events" USING btree ("org_id","created_at");

-- org_id is present, so rls-invariants.spec.ts requires row security ENABLEd,
-- FORCEd and policed here. FORCE is what makes it real: without it the table
-- owner bypasses every policy and the tests pass while production leaks.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

-- NULLIF for the same reason as 0002: once set_config has run on a backend,
-- unwinding the LOCAL setting at COMMIT leaves the GUC as '' rather than NULL,
-- and ''::uuid raises 22P02 instead of denying. A policy that throws is not a
-- policy that denies.
CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- Append-only at the PRIVILEGE level, not the service level. The runtime role
-- may insert and read audit events and has no grant to change or remove one,
-- so no application bug, no future admin endpoint and no stray script can
-- rewrite history — the same reason tenancy lives in RLS rather than in a
-- service method. Both grants arrive implicitly: 0002 set ALTER DEFAULT
-- PRIVILEGES for app_runtime on tables created in this schema, so this table
-- was born with UPDATE and DELETE and they have to be taken back explicitly.
REVOKE UPDATE, DELETE ON audit_events FROM app_runtime;
