CREATE TABLE IF NOT EXISTS "vdd_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"source_file_name" text NOT NULL,
	"source_file_hash" varchar(64),
	"source_type" varchar(20) DEFAULT 'xlsx' NOT NULL,
	"sheet_name" varchar(255),
	"row_count" integer,
	"valid_row_count" integer,
	"invalid_row_count" integer,
	"status" varchar(30) DEFAULT 'processing' NOT NULL,
	"imported_by_user_id" uuid,
	"column_mappings" jsonb,
	"error_report" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vdd_reference_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"source_file_name" text NOT NULL,
	"source_row_number" integer NOT NULL,
	"importer_name" varchar(255),
	"declaration_number" varchar(100),
	"hs_code" varchar(20) NOT NULL,
	"unit_of_quantity" varchar(50),
	"origin_code" varchar(10),
	"country_name" varchar(100),
	"brand_or_make" varchar(150),
	"model" varchar(150),
	"common_name" text,
	"condition" varchar(50),
	"commercial_description" text,
	"appearance" varchar(50),
	"material" varchar(255),
	"size" varchar(100),
	"product_type" varchar(100),
	"diameter" numeric(18, 4),
	"width" numeric(18, 4),
	"length" numeric(18, 4),
	"declared_unit_price" numeric(18, 4),
	"net_mass" numeric(18, 3),
	"gross_mass" numeric(18, 3),
	"currency_code" varchar(3) DEFAULT 'USD' NOT NULL,
	"normalized_text" text,
	"normalized_data" jsonb,
	"raw_row" jsonb,
	"data_quality_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vdd_import_batches" ADD CONSTRAINT "vdd_import_batches_imported_by_user_id_users_id_fk" FOREIGN KEY ("imported_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vdd_reference_records" ADD CONSTRAINT "vdd_reference_records_import_batch_id_vdd_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."vdd_import_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_import_batches_tenant" ON "vdd_import_batches" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_import_batches_status" ON "vdd_import_batches" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_import_batches_created" ON "vdd_import_batches" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_hs_code" ON "vdd_reference_records" USING btree ("hs_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_model" ON "vdd_reference_records" USING btree ("model");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_brand" ON "vdd_reference_records" USING btree ("brand_or_make");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_origin" ON "vdd_reference_records" USING btree ("origin_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_common_name" ON "vdd_reference_records" USING btree ("common_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_batch" ON "vdd_reference_records" USING btree ("import_batch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_reference_records_tenant" ON "vdd_reference_records" USING btree ("tenant_id");
