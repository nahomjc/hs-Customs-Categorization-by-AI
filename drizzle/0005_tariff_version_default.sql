-- Ensure tariff_version has a DB default when omitted from inserts
ALTER TABLE "hs_code_candidates" ALTER COLUMN "tariff_version" SET DEFAULT 'ETH-2024';
