-- Per-database grants for app_runtime. Run INSIDE each application database
-- (appstore, appstore_test), as the role that owns the schema and runs migrations:
--
--   psql -d appstore      -f infra/local/grants.sql
--   psql -d appstore_test -f infra/local/grants.sql
--
-- Safe to re-run. Run it again after adding tables outside of a migration.

\set ON_ERROR_STOP on

GRANT USAGE ON SCHEMA public TO app_runtime;

-- Deliberately NOT granted: CREATE on the schema. The runtime role manipulates
-- rows; it never creates, alters, or drops objects. A compromised application
-- credential cannot then drop a policy to escape its own tenant.
REVOKE CREATE ON SCHEMA public FROM app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- Applies to tables created LATER by this same role, so future migrations do
-- not each have to remember to grant. FOR ROLE defaults to CURRENT_USER, which
-- is why migrations must always run as the same role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- The audit log is append-only at the privilege level. Migration 0004 re-applies
-- this after creating the table; repeated here so a manual re-run cannot silently
-- restore the ability to rewrite history.
DO $audit$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_events') THEN
    REVOKE UPDATE, DELETE ON audit_events FROM app_runtime;
    RAISE NOTICE 'audit_events: UPDATE and DELETE revoked from app_runtime';
  END IF;
END
$audit$;

SELECT
  current_database() AS database,
  has_schema_privilege('app_runtime', 'public', 'USAGE')  AS can_use_schema,
  has_schema_privilege('app_runtime', 'public', 'CREATE') AS can_create_objects_should_be_false;
