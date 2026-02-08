CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"uploaded_by" varchar(100) NOT NULL,
	"original_file_url" text NOT NULL,
	"original_file_name" varchar(255),
	"file_type" varchar(20) NOT NULL,
	"extracted_text" text,
	"status" varchar(30) DEFAULT 'uploaded',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"raw_line" text NOT NULL,
	"detected_description" text,
	"detected_quantity" integer,
	"detected_unit" text,
	"line_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"ai_category" varchar(100),
	"ai_hs_code" varchar(20),
	"clean_description" text,
	"confidence" numeric(5, 2),
	"ai_raw_response" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grouped_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"hs_code" varchar(20) NOT NULL,
	"category" varchar(100) NOT NULL,
	"final_description" text NOT NULL,
	"total_quantity" integer NOT NULL,
	"unit" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_code_reference" (
	"hs_code" varchar(20) PRIMARY KEY NOT NULL,
	"category" varchar(100),
	"description" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_classifications" ADD CONSTRAINT "item_classifications_item_id_document_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."document_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "grouped_items" ADD CONSTRAINT "grouped_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
