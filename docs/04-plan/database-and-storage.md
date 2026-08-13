# Database & Storage Configuration

> Companion to [`01-api-core.md`](01-api-core.md). Amends its Tasks 3, 4, 10 and 11 to match the machine this project is actually built on.
>
> **Evidence status.** Everything in §1 and §2 was measured directly — SQL run against local PostgreSQL **17.10** and **15.18**, and against a live Supabase project on PostgreSQL **17.6**, all on 2026-08-12. §4 is reasoned from those measurements. §6 lists what remains **unverified** and must be confirmed by running it.

---

## 1. The isolation design, verified

### Verdict per target

| Target | Works? | Notes |
|---|---|---|
| **Local PostgreSQL 17.10**, port 5433 ← *the project's database* | ✅ Verified end-to-end | App connects *as* `app_runtime` (`rolbypassrls = false`) |
| **Local PostgreSQL 15.18**, port 5432 | ✅ Verified end-to-end | Pre-existing cluster with unrelated data; untouched. Kept only as evidence the design is not 17-specific |
| **Supabase hosted, PostgreSQL 17.6** | ✅ Design holds, with one caveat below | App connects as `postgres` (`rolbypassrls = **true**`) |
| **Supabase local CLI stack** | ⛔ Unavailable | `supabase start` needs Docker; not installed |

Local and production now share major version 17, so the earlier skew is closed. The design was verified on 15.18 *and* 17.10 — including the `NULLIF` behaviour below, which reproduces identically on both.

### The measured role table on Supabase

```
role             rolsuper   rolbypassrls   rolcreaterole
postgres         false      TRUE           TRUE     <-- you connect as this
service_role     false      TRUE           false
anon             false      false          false
authenticated    false      false          false
supabase_admin   TRUE       TRUE           TRUE
```

Two consequences, and the second is the important one:

1. `postgres` has **`rolcreaterole = true`**, so `CREATE ROLE app_runtime` succeeds on managed Supabase. The design is portable.
2. `postgres` has **`rolbypassrls = true`**. Every policy — `ENABLE`, `FORCE`, all of it — is **inert** on a connection left as `postgres`.

> On Supabase, `SET LOCAL ROLE app_runtime` inside `withTenant()` is not defence in depth. It is the *only* control standing between a request and every other tenant's data. Locally the app connects as a non-bypassing role, so there are two layers; on Supabase there is one. Any query that reaches tenant tables outside `withTenant()` is a full cross-tenant leak on production and will look perfectly fine in local tests.

### The NULLIF correction

`01-api-core.md` Task 4 originally wrote:

```sql
USING (org_id = current_setting('app.current_org_id', true)::uuid)
```

That is wrong, and the failure mode is nasty. Measured identically on 15.18 **and** 17.10:

| State | `current_setting('app.current_org_id', true)` returns |
|---|---|
| Never set on this backend | `NULL` |
| **After `set_config` ran once and the LOCAL value unwound at COMMIT** | `''` — **empty string** |

`''::uuid` raises `22P02 invalid_text_representation`. So an unscoped query **errors** instead of returning zero rows — and because connections are pooled, a backend that has already served one tenant request is the *ordinary* case, not an edge case. A policy that throws is not a policy that denies.

The corrected predicate, used by every policy in the plan:

```sql
USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
```

Task 4 carries a regression test that runs an unscoped query *after* a scoped one on the same pool — the exact sequence that fails without `NULLIF`.

### What was actually run

Against local PostgreSQL 17.10 (and re-run on 15.18), connected as `app_runtime`:

| Check | Result |
|---|---|
| `rolbypassrls` on the connecting role | `false` |
| Unscoped `SELECT` | `0 rows` — default deny, no error |
| Scoped `SELECT` | `1 row`, correct tenant |
| Cross-tenant `INSERT` | `ERROR: new row violates row-level security policy` |
| Cross-tenant `UPDATE` | 1 row touched, never 2 |
| `UPDATE` on audit table | `ERROR: permission denied for table` |
| Role/GUC after `COMMIT` | unwound — nothing leaks to the next borrower |
| `SET LOCAL ROLE app_runtime` while already `app_runtime` | permitted (self-set) |

That last row is what lets one code path serve both targets: locally it is a harmless self-set, on Supabase it drops `postgres`'s BYPASSRLS.

---

## 2. This machine

| Tool | Found | Consequence |
|---|---|---|
| PostgreSQL | **17.10** on 5433 (this project) · **15.18** on 5432 (pre-existing) | Major version now matches Supabase |
| Node | **v24.14.1** (nvm) | `.nvmrc` must say `24`, not `22` |
| pnpm | installed | — |
| Supabase CLI | installed | `link` / `db push` work; `start` does not |
| **Docker** | **NOT INSTALLED** | ⛔ Testcontainers and MinIO are both unavailable |

### Two clusters, deliberately

Supabase publishes no PostgreSQL 16 at all, and both projects on this account run engine **17**. The plan's original `postgres:16-alpine` pin was therefore wrong in both directions — it matched neither the machine nor any Supabase target.

PostgreSQL 17 was installed alongside the existing 15 rather than replacing it:

```bash
brew install postgresql@17          # keg-only, no conflict with 15
brew services start postgresql@17   # listens on 5433
```

`port = 5433` was set in `/opt/homebrew/var/postgresql@17/postgresql.conf` **before first start**, so the two clusters could never contend for 5432. The 15.18 cluster and its unrelated data are untouched and still serving on 5432; nothing in this project connects to it.

This project uses **5433** everywhere. If `setup.sh` reports a major other than 17, the service is not running.

---

## 3. Local setup

No Docker required.

```bash
./infra/local/setup.sh
```

Idempotent. Creates the `app_runtime` LOGIN role, the `appstore` and `appstore_test` databases, and the grants — then prints the connection strings. It never touches any other database.

Then:

```bash
cp .env.example .env
```

| File | Role |
|---|---|
| `infra/local/bootstrap.sql` | cluster-level: role + databases |
| `infra/local/grants.sql` | per-database grants; re-runnable |
| `infra/local/setup.sh` | orchestrates both, verifies the server first |
| `infra/supabase/bootstrap.sql` | the Supabase equivalent, run once per project |

`app_runtime` is deliberately denied `CREATE` on `public`. It moves rows; it cannot create, alter, or drop objects — so a stolen application credential cannot drop a policy to escape its own tenant.

---

## 4. Environment contract

| Variable | Local | Supabase | Used by |
|---|---|---|---|
| `DATABASE_URL` | `postgres://app_runtime:devpassword@localhost:5433/appstore` | `postgres://postgres.<REF>:<PW>@aws-0-<REGION>.pooler.supabase.com:**6543**/postgres?sslmode=require` | app runtime |
| `DIRECT_URL` | same as `DATABASE_URL` | `postgres://postgres:<PW>@db.<REF>.supabase.co:**5432**/postgres?sslmode=require` | long/session work |
| `MIGRATION_DATABASE_URL` | `postgres://localhost:5433/appstore` (your OS user) | same as `DIRECT_URL` | drizzle-kit |
| `BLOB_STORE` | `fs` | `s3` | adapter selection |
| `S3_ENDPOINT` | — | `https://<REF>.storage.supabase.co/storage/v1/s3` | S3 adapter |
| `JWT_SECRET` | ≥32 chars | ≥32 chars | auth |

**Why two URLs.** Runtime uses Supavisor **transaction mode** (6543), which returns the connection to the pool at `COMMIT`. That is precisely why `withTenant()` uses `SET LOCAL` and `set_config(..., true)` — both unwind at `COMMIT` and cannot leak to the next borrower. Migrations must *not* use 6543: DDL, advisory locks, and multi-statement transactions need a stable session, so they use the direct connection.

**Prepared statements** must stay disabled in transaction mode. `src/db/client.ts` already passes `{ prepare: false }` to postgres.js.

**Migrations run as the schema owner**, never as `app_runtime` — which has no `CREATE`. `ALTER DEFAULT PRIVILEGES` is scoped `FOR ROLE` that owner, so migrations must always run as the same role or future tables silently lack grants.

---

## 5. Amendments to Plan 01

| Task | Was | Now | Why |
|---|---|---|---|
| **3** | Testcontainers spins `postgres:16-alpine` | Connect to `TEST_DATABASE_URL`; create/drop a scratch **schema** per suite | Docker not installed |
| **3** | `.nvmrc` = `22` | `.nvmrc` = `24` | Machine has Node 24.14.1; `nvm use` would fail on 22 |
| **4** | `current_setting(...)::uuid` | `NULLIF(current_setting(...), '')::uuid` | Errors instead of denying on a pooled connection — §1 |
| **4** | Role created inside migration | Role created by `infra/*/bootstrap.sql`, *before* migrations | Role creation needs privileges migrations should not assume; Supabase needs a different variant |
| **10** | MinIO via Testcontainers | `FsBlobStore` for local/test; `S3BlobStore` for Supabase/prod, selected by `BLOB_STORE` | No Docker. Also proves the port abstraction is real rather than decorative |
| **10** | S3 contract test always runs | Runs only when `S3_ENDPOINT` is configured; skipped otherwise with a logged reason | Must not silently pass by not running |
| **11** | — | unchanged | Streaming hash-on-write is adapter-agnostic |

The `FsBlobStore` substitution is worth stating plainly: it is a **downgrade in fidelity**. Filesystem semantics are not S3 semantics — no eventual consistency, no multipart edge cases, no presigned-URL expiry behaviour. The S3 contract test against a real endpoint is what closes that gap, and it must be run before any deploy, not treated as optional.

---

## 6. Open risks and unknowns

Named rather than papered over. The adversarial verification phase of the research run **died on a session limit**, so nothing below carries independent confirmation.

1. **Supabase Storage S3 compatibility is UNVERIFIED.** The endpoint shape `https://<REF>.storage.supabase.co/storage/v1/s3` and `forcePathStyle: true` come from a single unverified agent claim. Specifically unconfirmed: whether `CopyObject` is supported — **Task 11's upload path depends on it** for the staging→content-addressed rename. If `CopyObject` is missing, that task needs the client-declared-digest approach flagged in Plan 01's self-review. Confirm before writing the S3 adapter.
2. **The 2 GiB artifact ceiling on Supabase Storage is unconfirmed** per plan tier. If the real ceiling is lower, `MAX_ARTIFACT_BYTES` and the BRD's FR-2.7 both need revising.
3. **Supavisor transaction-mode behaviour is reasoned, not tested.** `SET LOCAL` unwinding at `COMMIT` is standard PostgreSQL and was verified locally, but not through Supavisor itself. Test against a real project before relying on it.
4. **No Supabase project exists for this application.** The projects already on the account are unrelated to it; the role and version facts in §1 came from read-only catalog queries against one of them. A dedicated project must be created before any of §4's Supabase column can be filled in.
5. **`ALTER DEFAULT PRIVILEGES FOR ROLE postgres`** on Supabase is untested — it is in `infra/supabase/bootstrap.sql` but has never been executed there.
6. **Revoking `anon`/`authenticated`** may interfere with Supabase dashboard features that assume PostgREST. Harmless for this application, but expect the Table Editor to behave oddly.

---

*Written 2026-08-12 from direct measurement. Supersedes the Testcontainers and Postgres-16 assumptions in `01-api-core.md`.*
