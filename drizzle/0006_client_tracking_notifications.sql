-- Client tracking + Telegram/SMS notification channels
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(30);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" varchar(64);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_link_token" varchar(64);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_linked_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "import_cases" ADD COLUMN IF NOT EXISTS "client_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "import_cases" ADD COLUMN IF NOT EXISTS "tracking_status" varchar(40) DEFAULT 'received' NOT NULL;
--> statement-breakpoint
ALTER TABLE "import_cases" ADD COLUMN IF NOT EXISTS "tracking_note" text;
--> statement-breakpoint
ALTER TABLE "import_cases" ADD COLUMN IF NOT EXISTS "tracking_updated_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "import_cases" ADD COLUMN IF NOT EXISTS "tracking_updated_by_user_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_cases" ADD CONSTRAINT "import_cases_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_cases" ADD CONSTRAINT "import_cases_tracking_updated_by_user_id_users_id_fk" FOREIGN KEY ("tracking_updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_cases_client_user" ON "import_cases" USING btree ("client_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_channel_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"telegram_enabled" boolean DEFAULT false NOT NULL,
	"telegram_bot_token" text,
	"telegram_bot_username" varchar(100),
	"telegram_webhook_secret" varchar(128),
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"sms_ethiopia_api_key" text,
	"authorized_staff_phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_channel_settings_tenant_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenant_channel_settings_tenant" ON "tenant_channel_settings" USING btree ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracking_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"import_case_id" uuid NOT NULL,
	"status" varchar(40) NOT NULL,
	"note" text,
	"source" varchar(30) DEFAULT 'web' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracking_status_events" ADD CONSTRAINT "tracking_status_events_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracking_status_events" ADD CONSTRAINT "tracking_status_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tracking_status_events_case" ON "tracking_status_events" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tracking_status_events_tenant" ON "tracking_status_events" USING btree ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"user_id" uuid NOT NULL,
	"import_case_id" uuid,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" USING btree ("user_id","read");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"import_case_id" uuid,
	"user_id" uuid,
	"channel" varchar(30) NOT NULL,
	"status" varchar(30) NOT NULL,
	"payload_snippet" text,
	"error" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_logs_case" ON "notification_logs" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_logs_tenant" ON "notification_logs" USING btree ("tenant_id");
--> statement-breakpoint
-- Backfill phone from legacy meta.phone when present
UPDATE "users"
SET "phone" = NULLIF(TRIM(meta->>'phone'), '')
WHERE "phone" IS NULL
  AND meta ? 'phone'
  AND NULLIF(TRIM(meta->>'phone'), '') IS NOT NULL;
