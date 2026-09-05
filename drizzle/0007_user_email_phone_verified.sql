ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Sync email_verified from Better Auth user table when linked by id
UPDATE "users" u
SET "email_verified" = true
FROM "user" au
WHERE au.id = u.id::text
  AND au.email_verified = true
  AND u.email_verified = false;
