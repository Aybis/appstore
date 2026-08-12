-- Local Postgres bootstrap for the enterprise app store.
--
-- Run against the `postgres` maintenance database as a superuser:
--   psql -d postgres -v runtime_password="'devpassword'" -f infra/local/bootstrap.sql
--
-- Creates the app_runtime role and the appstore / appstore_test databases.
-- Per-database grants live in grants.sql, which must run inside each database.
--
-- WHY app_runtime EXISTS AT ALL
-- -----------------------------
-- Verified 2026-08-12 against Supabase PostgreSQL 17.6: the `postgres` role
-- Supabase hands you has rolbypassrls = true. A connection as that role ignores
-- every RLS policy, FORCE included. withTenant() therefore issues
-- `SET LOCAL ROLE app_runtime` before touching tenant data, dropping to a role
-- with rolbypassrls = false.
--
-- Locally we go one better: app_runtime is a LOGIN role and the app connects AS
-- it directly, so the SET LOCAL ROLE is a self-set (always permitted) and the
-- same code path works unchanged against both targets.

\set ON_ERROR_STOP on

-- Default keeps a clean checkout working. This credential is local-only and
-- never leaves the machine — production credentials come from the environment.
--
-- NOTE: psql does NOT interpolate :variables inside dollar-quoted blocks, so
-- every statement below is built with format() and dispatched via \gexec.
\if :{?runtime_password}
\else
  \set runtime_password '''devpassword'''
\endif

SELECT format('CREATE ROLE app_runtime WITH LOGIN PASSWORD %L', :runtime_password)
 WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime')\gexec

-- Always normalise the password so a re-run repairs a drifted local setup.
SELECT format('ALTER ROLE app_runtime WITH LOGIN PASSWORD %L', :runtime_password)\gexec

-- Explicit membership so the migrating role can SET ROLE into app_runtime.
-- On PostgreSQL 16+ a CREATEROLE role receives this implicitly when it creates
-- the role; granting it outright keeps the script correct on 15 too.
GRANT app_runtime TO CURRENT_USER;

SELECT 'CREATE DATABASE appstore'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'appstore')\gexec

SELECT 'CREATE DATABASE appstore_test'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'appstore_test')\gexec

-- app_runtime may connect, but holds no rights inside either database until
-- grants.sql runs there.
GRANT CONNECT ON DATABASE appstore      TO app_runtime;
GRANT CONNECT ON DATABASE appstore_test TO app_runtime;

SELECT 'bootstrap complete: role=app_runtime databases=appstore,appstore_test' AS status;
