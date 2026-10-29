-- A profile picture per person.
--
-- The image itself lives in the file store under avatars/, named by its
-- SHA-256 like app icons (icons/), so identical pictures are stored once and
-- the URL never serves different bytes. '' means no picture: the apps then
-- draw the person's initials.
--
-- As with 0002-0016, the statement-breakpoint marker is deliberately never
-- spelled out in this file.
ALTER TABLE "users" ADD COLUMN "avatar_key" text DEFAULT '' NOT NULL;
