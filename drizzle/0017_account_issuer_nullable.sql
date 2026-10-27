-- Better Auth 1.7.3+: issuer is no longer written. Relax NOT NULL + drop unique index.
-- https://www.better-auth.com/docs/guides/1-7-upgrade-guide
DROP INDEX IF EXISTS "account_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
