CREATE TABLE IF NOT EXISTS "vdd_product_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"vdd_reference_record_id" uuid NOT NULL,
	"similarity_score" numeric(5, 4) NOT NULL,
	"match_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"differences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hs_code_matches" boolean,
	"price_comparison" jsonb,
	"is_used_as_evidence" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vdd_product_matches" ADD CONSTRAINT "vdd_product_matches_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vdd_product_matches" ADD CONSTRAINT "vdd_product_matches_vdd_reference_record_id_vdd_reference_records_id_fk" FOREIGN KEY ("vdd_reference_record_id") REFERENCES "public"."vdd_reference_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vdd_product_matches_product_vdd_unique" ON "vdd_product_matches" USING btree ("product_id","vdd_reference_record_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_product_matches_product" ON "vdd_product_matches" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vdd_product_matches_score" ON "vdd_product_matches" USING btree ("similarity_score");
