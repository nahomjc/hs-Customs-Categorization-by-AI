CREATE TABLE IF NOT EXISTS "hs_code_search_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"user_id" uuid,
	"query_text" text NOT NULL,
	"extracted_attributes" jsonb,
	"results_count" integer DEFAULT 0 NOT NULL,
	"top_hs_code_suggested" varchar(20),
	"top_confidence_score" numeric(5, 4),
	"ai_model_name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hs_code_search_logs" ADD CONSTRAINT "hs_code_search_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_code_search_logs_tenant" ON "hs_code_search_logs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_code_search_logs_user" ON "hs_code_search_logs" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_code_search_logs_created" ON "hs_code_search_logs" USING btree ("created_at");
