-- Presentation fields the catalog surface needs but the core record did not
-- carry. These live on `apps` rather than `releases` because they describe the
-- product, not a build: a new version does not restate its own publisher.
--
-- As with 0002 and 0003, the statement-breakpoint marker is deliberately never
-- spelled out in this file. drizzle-orm splits the raw text with no comment
-- awareness, so an occurrence in prose splits the migration for real.
ALTER TABLE "apps" ADD COLUMN "tagline" text DEFAULT '' NOT NULL;
ALTER TABLE "apps" ADD COLUMN "publisher" text DEFAULT '' NOT NULL;
ALTER TABLE "apps" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;

-- Aggregates, not source of truth: ratings themselves are a later phase
-- (FR-5.x). Kept denormalised here so the catalog list is a single scan.
ALTER TABLE "apps" ADD COLUMN "rating" real DEFAULT 0 NOT NULL;
ALTER TABLE "apps" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "apps" ADD COLUMN "screenshot_urls" text[] DEFAULT '{}' NOT NULL;

CREATE INDEX "apps_org_featured_idx" ON "apps" ("org_id","featured");
