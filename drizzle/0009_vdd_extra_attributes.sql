ALTER TABLE "vdd_import_batches" ADD COLUMN IF NOT EXISTS "extra_columns" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "vdd_reference_records" ADD COLUMN IF NOT EXISTS "extra_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;
