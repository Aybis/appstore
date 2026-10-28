-- Self-registration, deactivation, and per-person app visibility.
--
-- STATUS. Removing a membership is the only way to cut somebody off today, and
-- it destroys the record: their name, their role, and every tester enrolment
-- go with it. An admin who wants to suspend an account while a question is
-- sorted out had no way to say so. `status` is that: 'disabled' keeps the row
-- and refuses the person, and flipping it back restores everything.
--
-- APP ACCESS. `all` is the existing behaviour (every app the track rules
-- allow), and it is the default so nobody already in the system loses
-- anything. `selected` limits an employee to the apps granted in
-- `user_app_access`. People who register themselves are created `selected`
-- with no grants, so open registration exposes nothing until an admin decides.
-- Staff roles (publisher, admin, owner) ignore this: they manage the catalog
-- and cannot do that blind.
--
-- As with 0002-0014, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
CREATE TYPE "membership_status" AS ENUM ('active', 'disabled');

CREATE TYPE "app_access_mode" AS ENUM ('all', 'selected');

ALTER TABLE "memberships" ADD COLUMN "status" "membership_status" DEFAULT 'active' NOT NULL;

ALTER TABLE "memberships" ADD COLUMN "app_access" "app_access_mode" DEFAULT 'all' NOT NULL;

CREATE TABLE "user_app_access" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "app_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "granted_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "user_app_access" ADD CONSTRAINT "user_app_access_org_id_fk"
  FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_app_access" ADD CONSTRAINT "user_app_access_app_id_fk"
  FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_app_access" ADD CONSTRAINT "user_app_access_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_app_access" ADD CONSTRAINT "user_app_access_granted_by_fk"
  FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

CREATE UNIQUE INDEX "user_app_access_app_user_key" ON "user_app_access" ("app_id","user_id");
CREATE INDEX "user_app_access_org_user_idx" ON "user_app_access" ("org_id","user_id");

ALTER TABLE user_app_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_access FORCE ROW LEVEL SECURITY;
CREATE POLICY user_app_access_tenant_isolation ON user_app_access
  USING      (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
