-- API keys: uploads from CI, without a human session.
--
-- The whole point of the CMS is that builds enter through the API, and a build
-- server cannot hold a password. Today a release is pushed with a user's own
-- access token, which means a pipeline either holds somebody's credentials or
-- a human runs every deploy by hand.
--
-- THE CHECK CONSTRAINT IS THE POINT (security review S-8). `role` is capped at
-- `publisher` in the DATABASE, not in a service that a later refactor could
-- route around. A CI key able to add admins is a privilege-escalation
-- primitive, and CI tokens leak far more often than passwords do — into build
-- logs, into forks of a repository, onto a shared screen. Anything that leaks
-- that easily must not be able to grant anything.
--
-- The secret is never stored. Only its argon2id hash is, exactly as passwords
-- are, so a dump of this table is not a set of working credentials. `prefix`
-- exists so the console can say WHICH key without ever holding the secret.
--
-- As with 0002-0010, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "name" text NOT NULL,
  "prefix" text NOT NULL,
  "secret_hash" text NOT NULL,
  "role" "membership_role" NOT NULL DEFAULT 'publisher',
  "created_by" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  "last_used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
-- The key outlives whoever minted it: deleting a departed employee's account
-- must not silently delete the pipeline credential their team still depends on.
-- Revoking it is a decision somebody makes, not a side effect of offboarding.
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- S-8. Enforced here rather than in a Zod schema or a service check, because
-- those protect the paths somebody remembered to route through them. This
-- protects the table.
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_role_capped"
  CHECK ("role" IN ('viewer', 'publisher'));

-- An expiry is not optional. A credential with no end date is one nobody ever
-- has a reason to look at again.
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_expires_after_creation"
  CHECK ("expires_at" > "created_at");

-- Lookup is by prefix, so it must identify exactly one key.
CREATE UNIQUE INDEX "api_keys_prefix_key" ON "api_keys" ("prefix");
CREATE INDEX "api_keys_org_idx" ON "api_keys" ("org_id","revoked_at");

-- Carries org_id, so rls-invariants.spec.ts requires row security ENABLEd,
-- FORCEd and policed. NULLIF for the same reason as 0002.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant_isolation ON api_keys
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
