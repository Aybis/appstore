-- One artifact per release, not one artifact per digest.
--
-- `artifacts` was UNIQUE (org_id, sha256), and the insert carried
-- ON CONFLICT DO NOTHING. So publishing a build whose bytes are byte-identical
-- to an earlier one — re-tagging 1.0.0 as 1.0.1, re-publishing after a
-- rollback — created the release row and then SILENTLY skipped its artifact.
-- The result is a release that the catalog cannot see (it INNER JOINs
-- artifacts) and that can never be downloaded, with no error anywhere.
--
-- The constraint's stated purpose was cross-tenant: "two organizations may hold
-- an identical binary and neither may probe for the other's copy". That
-- guarantee lives in the STORAGE KEY, which is `orgs/{orgId}/artifacts/{sha256}`
-- and is unaffected by this change. Within one org, two releases carrying the
-- same bytes is legitimate and must be representable.
--
-- The marker is deliberately never spelled out in this file.
DROP INDEX IF EXISTS "artifacts_org_sha256_key";

-- The real invariant: a release has exactly one binary.
CREATE UNIQUE INDEX "artifacts_release_key" ON "artifacts" ("release_id");

-- Kept non-unique, for looking up which releases share a digest.
CREATE INDEX "artifacts_org_sha256_idx" ON "artifacts" ("org_id","sha256");
