ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "classification_mode" varchar(30) DEFAULT 'ai';
--> statement-breakpoint
ALTER TABLE "document_items" ADD COLUMN IF NOT EXISTS "source_hs_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "document_items" ADD COLUMN IF NOT EXISTS "line_number" integer;
--> statement-breakpoint
ALTER TABLE "document_items" ADD COLUMN IF NOT EXISTS "specification" text;
