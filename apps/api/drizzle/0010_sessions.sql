-- Refresh sessions: revocation, rotation, and replay detection.
--
-- Refresh tokens were stateless 30-day JWTs and `POST /v1/auth/refresh` was
-- @Public(). Measured on 2026-08-23: delete a member's `memberships` row and
-- their access token is correctly refused (403, RolesGuard re-reads
-- membership), but the same refresh token still minted fresh pairs for the
-- full thirty days. Nothing was breached, because every data path re-reads
-- membership — but "sign out" could not invalidate anything, a stolen token
-- could never be cut off, and the first endpoint to trust a JWT claim without
-- re-reading membership would have turned it into a real breach.
--
-- The token itself is never stored. Only its SHA-256 is, for the same reason
-- passwords are hashed: a dump of this table must not be a set of working
-- credentials.
--
-- As with 0002-0009, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "rotated_from" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_reason" text,
  "user_agent" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_org_id_organizations_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
-- The chain must survive its own pruning: losing the ancestor would erase the
-- evidence that a replayed token belonged to a rotated line.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rotated_from_sessions_id_fk"
  FOREIGN KEY ("rotated_from") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;

-- One row per token. The hash is what a refresh looks itself up by, so a
-- duplicate would make "which session is this" ambiguous.
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" ("token_hash");
CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id","revoked_at");
CREATE INDEX "sessions_org_idx" ON "sessions" ("org_id");

-- Carries org_id, so rls-invariants.spec.ts requires row security ENABLEd,
-- FORCEd and policed. NULLIF for the same reason as 0002: an unwound LOCAL
-- setting reads back as '' rather than NULL, and ''::uuid raises 22P02 instead
-- of denying.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY sessions_tenant_isolation ON sessions
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
