ALTER TABLE "tenant_channel_settings" ADD COLUMN IF NOT EXISTS "sms_provider" varchar(20) DEFAULT 'smshub' NOT NULL;
ALTER TABLE "tenant_channel_settings" ADD COLUMN IF NOT EXISTS "sms_smshub_api_key" text;

UPDATE "tenant_channel_settings"
SET "sms_provider" = 'sms_ethiopia'
WHERE "sms_ethiopia_api_key" IS NOT NULL
  AND "sms_smshub_api_key" IS NULL;
