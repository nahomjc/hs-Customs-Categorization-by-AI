ALTER TABLE "vdd_reference_records" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar(512);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vdd_reference_records_tenant_dedupe"
  ON "vdd_reference_records" ("tenant_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vdd_custom_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar(30) NOT NULL,
  "field_key" varchar(80) NOT NULL,
  "label" varchar(150) NOT NULL,
  "value_type" varchar(20) DEFAULT 'text' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_custom_fields_tenant" ON "vdd_custom_fields" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_vdd_custom_fields_tenant_key"
  ON "vdd_custom_fields" ("tenant_id", "field_key");
