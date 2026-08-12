-- This file is sent to Postgres as a single simple-protocol string (drizzle-orm's
-- migrator splits only on the literal "--> statement-breakpoint" marker and does
-- not otherwise parse SQL). Do NOT add that marker inside the dollar-quoted DO
-- block below: splitting mid-literal would hand Postgres two unterminated
-- fragments instead of one valid statement. The DO block is deliberately the
-- only multi-statement unit in this file for that reason.
--
-- The app_runtime role is NOT created here. It is a cluster-level object owned by
-- infra/local/bootstrap.sql (local) and infra/supabase/bootstrap.sql (hosted), both
-- of which run once, before any migration. Two reasons it does not belong in a
-- migration: creating roles needs privileges migrations should not have to assume,
-- and the two targets need different variants (LOGIN with a password locally,
-- NOLOGIN on Supabase where the app authenticates as `postgres` and drops into it).
--
-- This migration fails loudly if the bootstrap has not been run, rather than
-- silently producing tables with no grants.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    RAISE EXCEPTION 'role app_runtime is missing - run infra/local/setup.sh (or infra/supabase/bootstrap.sql) before migrating';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- FORCE is what makes this real: without it the table owner silently bypasses
-- every policy below, and the tests would pass while production leaked.
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps FORCE ROW LEVEL SECURITY;

-- The NULLIF is load-bearing, and the reason is not obvious.
--
-- current_setting('app.current_org_id', true) returns NULL only while the GUC
-- has NEVER been set on this backend. Once set_config has run once, unwinding
-- the LOCAL setting at COMMIT leaves the GUC as '' (EMPTY STRING), not NULL.
-- On a pooled connection that is the ordinary state of every reused backend.
--
-- Without NULLIF, ''::uuid raises 22P02 invalid_text_representation, so an
-- unscoped query ERRORS instead of returning zero rows -- a policy that throws
-- is not a policy that denies. Verified empirically against PostgreSQL 15.18
-- and 17.10.
CREATE POLICY apps_tenant_isolation ON apps
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant_isolation ON memberships
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
