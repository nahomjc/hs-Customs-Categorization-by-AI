DROP TABLE IF EXISTS "hs_code_reference";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_code_reference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"heading" varchar(20),
	"hs_code" varchar(20),
	"tariff_no" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"std_unit" varchar(30),
	"duty_rate" varchar(30),
	"chapter" varchar(2),
	"normalized_hs" varchar(20),
	"imported_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "hs_code_reference_tariff_no_unique" UNIQUE("tariff_no")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_ref_hs_code" ON "hs_code_reference" USING btree ("hs_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_ref_normalized_hs" ON "hs_code_reference" USING btree ("normalized_hs");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_ref_chapter" ON "hs_code_reference" USING btree ("chapter");
