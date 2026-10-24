ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "extra" jsonb;
--> statement-breakpoint
ALTER TABLE "packing_list_lines" ADD COLUMN IF NOT EXISTS "extra" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_column_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"document_type" varchar(30) NOT NULL,
	"header_signature" varchar(64) NOT NULL,
	"headers" jsonb,
	"mapping" jsonb NOT NULL,
	"supplier_name" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_column_mappings" ADD CONSTRAINT "import_column_mappings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_import_column_mappings_signature" ON "import_column_mappings" USING btree ("tenant_id","document_type","header_signature");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_column_mappings_tenant" ON "import_column_mappings" USING btree ("tenant_id");
