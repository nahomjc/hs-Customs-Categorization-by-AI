CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar(30) NOT NULL,
  "name" varchar(255) NOT NULL,
  "country_code" varchar(3),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_suppliers_tenant" ON "suppliers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_suppliers_tenant_name" ON "suppliers" ("tenant_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_suppliers_tenant_name_lower"
  ON "suppliers" ("tenant_id", lower("name"));

ALTER TABLE "import_cases"
  ADD COLUMN IF NOT EXISTS "supplier_id" uuid
  REFERENCES "suppliers"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_import_cases_supplier"
  ON "import_cases" ("supplier_id");

-- Backfill distinct non-empty supplier names per tenant, then link cases.
INSERT INTO "suppliers" ("tenant_id", "name", "country_code")
SELECT DISTINCT ON (ic."tenant_id", lower(trim(ic."supplier_name")))
  ic."tenant_id",
  trim(ic."supplier_name"),
  (
    SELECT ic2."supplier_country_code"
    FROM "import_cases" ic2
    WHERE ic2."tenant_id" = ic."tenant_id"
      AND lower(trim(ic2."supplier_name")) = lower(trim(ic."supplier_name"))
      AND ic2."supplier_country_code" IS NOT NULL
    ORDER BY ic2."updated_at" DESC NULLS LAST
    LIMIT 1
  )
FROM "import_cases" ic
WHERE ic."supplier_name" IS NOT NULL
  AND trim(ic."supplier_name") <> ''
ORDER BY ic."tenant_id", lower(trim(ic."supplier_name")), ic."updated_at" DESC NULLS LAST
ON CONFLICT DO NOTHING;

UPDATE "import_cases" ic
SET "supplier_id" = s."id"
FROM "suppliers" s
WHERE ic."supplier_id" IS NULL
  AND ic."supplier_name" IS NOT NULL
  AND trim(ic."supplier_name") <> ''
  AND s."tenant_id" = ic."tenant_id"
  AND lower(s."name") = lower(trim(ic."supplier_name"));
