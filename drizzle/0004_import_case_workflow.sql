CREATE TABLE IF NOT EXISTS "import_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"status" varchar(40) DEFAULT 'draft' NOT NULL,
	"importer_name" varchar(255),
	"importer_tin_number" varchar(50),
	"supplier_name" varchar(255),
	"supplier_country_code" varchar(3),
	"country_of_export_code" varchar(3),
	"country_of_origin_code" varchar(3),
	"shipment_reference" varchar(100),
	"bill_of_lading_number" varchar(100),
	"airway_bill_number" varchar(100),
	"import_procedure_code" varchar(50),
	"incoterm" varchar(20),
	"invoice_currency_code" varchar(3),
	"invoice_total_amount" numeric(18, 2),
	"freight_amount" numeric(18, 2),
	"insurance_amount" numeric(18, 2),
	"estimated_cif_amount" numeric(18, 2),
	"assigned_agent_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "import_cases_tenant_case_number_unique" UNIQUE("tenant_id","case_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_case_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_case_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"status" varchar(30) DEFAULT 'uploaded' NOT NULL,
	"original_file_name" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100),
	"file_size_bytes" integer,
	"file_hash" varchar(128),
	"page_count" integer,
	"extraction_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"extraction_confidence" numeric(5, 4),
	"extracted_data" jsonb,
	"document_number" varchar(100),
	"document_date" timestamptz,
	"related_invoice_number" varchar(100),
	"review_decision" varchar(30),
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamptz,
	"rejection_reason" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"supplier_description" text NOT NULL,
	"supplier_sku" varchar(100),
	"brand" varchar(100),
	"model_number" varchar(100),
	"quantity" numeric(18, 4) NOT NULL,
	"unit_of_measure" varchar(30) NOT NULL,
	"unit_price" numeric(18, 4),
	"line_total_amount" numeric(18, 2),
	"currency_code" varchar(3) NOT NULL,
	"country_of_origin_code" varchar(3),
	"declared_net_weight_kg" numeric(18, 3),
	"declared_gross_weight_kg" numeric(18, 3),
	"extraction_confidence" numeric(5, 4),
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by_user_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_lines_document_line_unique" UNIQUE("document_id","line_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packing_list_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_case_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"supplier_description" text NOT NULL,
	"supplier_sku" varchar(100),
	"brand" varchar(100),
	"model_number" varchar(100),
	"quantity" numeric(18, 4) NOT NULL,
	"unit_of_measure" varchar(30) NOT NULL,
	"package_type" varchar(50),
	"number_of_packages" numeric(18, 2),
	"pieces_per_package" numeric(18, 4),
	"net_weight_kg" numeric(18, 3),
	"gross_weight_kg" numeric(18, 3),
	"length_cm" numeric(18, 2),
	"width_cm" numeric(18, 2),
	"height_cm" numeric(18, 2),
	"package_marks" text,
	"country_of_origin_code" varchar(3),
	"extraction_confidence" numeric(5, 4),
	"is_reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by_user_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "packing_list_lines_document_line_unique" UNIQUE("document_id","line_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_case_id" uuid NOT NULL,
	"product_sequence" integer NOT NULL,
	"status" varchar(40) DEFAULT 'draft' NOT NULL,
	"raw_description" text NOT NULL,
	"normalized_description" text,
	"product_name" varchar(255),
	"brand" varchar(100),
	"model_number" varchar(100),
	"manufacturer" varchar(255),
	"material" varchar(255),
	"intended_use" text,
	"product_type" varchar(100),
	"technical_specifications" jsonb,
	"quantity" numeric(18, 4),
	"unit_of_measure" varchar(30),
	"unit_price" numeric(18, 4),
	"line_total_amount" numeric(18, 2),
	"currency_code" varchar(3),
	"country_of_origin_code" varchar(3),
	"net_weight_kg" numeric(18, 3),
	"gross_weight_kg" numeric(18, 3),
	"package_type" varchar(50),
	"number_of_packages" numeric(18, 2),
	"missing_information" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"normalization_confidence" numeric(5, 4),
	"human_verified" boolean DEFAULT false NOT NULL,
	"verified_by_user_id" uuid,
	"verified_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "import_products_case_sequence_unique" UNIQUE("import_case_id","product_sequence")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_invoice_lines" (
	"product_id" uuid NOT NULL,
	"invoice_line_id" uuid NOT NULL,
	"match_confidence" numeric(5, 4),
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "product_invoice_lines_product_id_invoice_line_id_pk" PRIMARY KEY("product_id","invoice_line_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_packing_list_lines" (
	"product_id" uuid NOT NULL,
	"packing_list_line_id" uuid NOT NULL,
	"match_confidence" numeric(5, 4),
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "product_packing_list_lines_product_id_packing_list_line_id_pk" PRIMARY KEY("product_id","packing_list_line_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hs_code_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"tariff_version" varchar(50) NOT NULL,
	"hs_code" varchar(20) NOT NULL,
	"official_description" text NOT NULL,
	"rank" integer NOT NULL,
	"confidence_score" numeric(5, 4) NOT NULL,
	"confidence_level" varchar(10) NOT NULL,
	"reasoning" text NOT NULL,
	"classification_evidence" jsonb,
	"missing_information" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_model_name" varchar(100),
	"prompt_version" varchar(50),
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "hs_code_candidates_product_rank_unique" UNIQUE("product_id","rank")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'suggested' NOT NULL,
	"hs_code" varchar(20) NOT NULL,
	"tariff_version" varchar(50) NOT NULL,
	"official_description" text NOT NULL,
	"classification_basis" text,
	"source" varchar(30) DEFAULT 'ai_suggestion' NOT NULL,
	"selected_candidate_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamptz,
	"reviewer_reason" text,
	"is_final" boolean DEFAULT false NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tariff_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"hs_code" varchar(20) NOT NULL,
	"tariff_version" varchar(50) NOT NULL,
	"country_of_origin_code" varchar(3),
	"procedure_code" varchar(50),
	"customs_duty_rate" numeric(8, 4),
	"vat_rate" numeric(8, 4),
	"excise_rate" numeric(8, 4),
	"surtax_rate" numeric(8, 4),
	"other_charges" jsonb,
	"permit_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_reference" text,
	"retrieved_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_case_id" uuid NOT NULL,
	"document_id" uuid,
	"product_id" uuid,
	"check_type" varchar(80) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamptz,
	"resolution_note" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_groupings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_case_id" uuid NOT NULL,
	"group_code" varchar(50) NOT NULL,
	"status" varchar(40) DEFAULT 'not_checked' NOT NULL,
	"hs_code" varchar(20),
	"country_of_origin_code" varchar(3),
	"procedure_code" varchar(50),
	"tax_profile_hash" varchar(128),
	"unit_of_measure" varchar(30),
	"grouping_reason" text,
	"cannot_group_reason" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamptz,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "product_groupings_case_group_code_unique" UNIQUE("import_case_id","group_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_grouping_items" (
	"grouping_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT "product_grouping_items_grouping_id_product_id_pk" PRIMARY KEY("grouping_id","product_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(30) NOT NULL,
	"import_case_id" uuid,
	"user_id" uuid,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(80) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"reason" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_cases" ADD CONSTRAINT "import_cases_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_cases" ADD CONSTRAINT "import_cases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_case_documents" ADD CONSTRAINT "import_case_documents_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_case_documents" ADD CONSTRAINT "import_case_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_case_documents" ADD CONSTRAINT "import_case_documents_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_document_id_import_case_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."import_case_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "packing_list_lines" ADD CONSTRAINT "packing_list_lines_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "packing_list_lines" ADD CONSTRAINT "packing_list_lines_document_id_import_case_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."import_case_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "packing_list_lines" ADD CONSTRAINT "packing_list_lines_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_products" ADD CONSTRAINT "import_products_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "import_products" ADD CONSTRAINT "import_products_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_invoice_lines" ADD CONSTRAINT "product_invoice_lines_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_invoice_lines" ADD CONSTRAINT "product_invoice_lines_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_packing_list_lines" ADD CONSTRAINT "product_packing_list_lines_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_packing_list_lines" ADD CONSTRAINT "product_packing_list_lines_packing_list_line_id_packing_list_lines_id_fk" FOREIGN KEY ("packing_list_line_id") REFERENCES "public"."packing_list_lines"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hs_code_candidates" ADD CONSTRAINT "hs_code_candidates_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_classifications" ADD CONSTRAINT "product_classifications_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_classifications" ADD CONSTRAINT "product_classifications_selected_candidate_id_hs_code_candidates_id_fk" FOREIGN KEY ("selected_candidate_id") REFERENCES "public"."hs_code_candidates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_classifications" ADD CONSTRAINT "product_classifications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tariff_snapshots" ADD CONSTRAINT "tariff_snapshots_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_checks" ADD CONSTRAINT "document_checks_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_checks" ADD CONSTRAINT "document_checks_document_id_import_case_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."import_case_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_checks" ADD CONSTRAINT "document_checks_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_checks" ADD CONSTRAINT "document_checks_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_groupings" ADD CONSTRAINT "product_groupings_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_groupings" ADD CONSTRAINT "product_groupings_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_grouping_items" ADD CONSTRAINT "product_grouping_items_grouping_id_product_groupings_id_fk" FOREIGN KEY ("grouping_id") REFERENCES "public"."product_groupings"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_grouping_items" ADD CONSTRAINT "product_grouping_items_product_id_import_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."import_products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_import_case_id_import_cases_id_fk" FOREIGN KEY ("import_case_id") REFERENCES "public"."import_cases"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_cases_tenant" ON "import_cases" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_cases_tenant_status" ON "import_cases" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_cases_assigned_agent" ON "import_cases" USING btree ("assigned_agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_cases_case_number" ON "import_cases" USING btree ("case_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_case_documents_case" ON "import_case_documents" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_case_documents_type" ON "import_case_documents" USING btree ("document_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_case_documents_status" ON "import_case_documents" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_case" ON "invoice_lines" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_document" ON "invoice_lines" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_packing_list_lines_case" ON "packing_list_lines" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_packing_list_lines_document" ON "packing_list_lines" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_products_case" ON "import_products" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_products_status" ON "import_products" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_code_candidates_product" ON "hs_code_candidates" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hs_code_candidates_hs_code" ON "hs_code_candidates" USING btree ("hs_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_checks_case" ON "document_checks" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_checks_severity" ON "document_checks" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_checks_status" ON "document_checks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_groupings_case" ON "product_groupings" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_groupings_status" ON "product_groupings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant" ON "audit_logs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_case" ON "audit_logs" USING btree ("import_case_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");
