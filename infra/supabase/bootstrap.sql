-- Supabase bootstrap — run ONCE per Supabase project, before the first migration.
--
--   psql "$DIRECT_URL" -f infra/supabase/bootstrap.sql
--
-- or paste into Dashboard > SQL Editor. Safe to re-run.
--
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE DEPLOYING
-- ---------------------------------------------------------------------------
-- Measured against a live Supabase project on PostgreSQL 17.6 (2026-08-12):
--
--   role            rolsuper   rolbypassrls
--   postgres        false      TRUE      <-- the role your app connects as
--   service_role    false      TRUE
--   anon            false      false
--   authenticated   false      false
--   supabase_admin  TRUE       TRUE
--
-- `postgres` holds BYPASSRLS. Every policy this project creates — ENABLE, FORCE,
-- all of it — is inert on a connection left as `postgres`. On Supabase the line
-- `SET LOCAL ROLE app_runtime` inside withTenant() is not defence in depth; it
-- is the ONLY control preventing a complete cross-tenant read. Do not "optimise"
-- it away, and do not run tenant queries outside withTenant().
--
-- `postgres` does have rolcreaterole = true, which is why the role below can be
-- created at all on managed Supabase.

\set ON_ERROR_STOP on

-- No LOGIN and no password: on Supabase nothing connects AS app_runtime. The
-- application authenticates as `postgres` and drops into this role per
-- transaction. Fewer credentials to leak.
SELECT 'CREATE ROLE app_runtime NOLOGIN'
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime')\gexec

-- Required so `postgres` may SET ROLE into app_runtime. PostgreSQL 16+ grants
-- this implicitly to a CREATEROLE creator; stated explicitly for clarity and to
-- survive a role created by some other path.
GRANT app_runtime TO postgres;

GRANT USAGE ON SCHEMA public TO app_runtime;

-- The runtime role manipulates rows and nothing else. Without CREATE it cannot
-- drop a policy to escape its own tenant, even with a stolen credential.
REVOKE CREATE ON SCHEMA public FROM app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- Applies to tables created later by `postgres`, i.e. by every future migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- Append-only audit log, enforced by privilege rather than by convention.
DO $audit$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_events') THEN
    REVOKE UPDATE, DELETE ON audit_events FROM app_runtime;
  END IF;
END
$audit$;

-- Deny Supabase's PostgREST roles outright. This project does not use PostgREST;
-- the API is the only way in. Leaving anon/authenticated with table access would
-- expose every table over the auto-generated REST endpoint.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

SELECT
  (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_runtime') AS app_runtime_bypassrls_must_be_false,
  (SELECT rolcanlogin  FROM pg_roles WHERE rolname = 'app_runtime') AS app_runtime_login_must_be_false,
  has_schema_privilege('app_runtime', 'public', 'CREATE')           AS app_runtime_create_must_be_false;
