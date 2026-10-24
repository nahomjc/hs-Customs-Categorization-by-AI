CREATE TABLE IF NOT EXISTS "hs_chapter_notes" (
	"chapter" varchar(2) PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"section_number" varchar(8),
	"section_title" text,
	"section_notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
