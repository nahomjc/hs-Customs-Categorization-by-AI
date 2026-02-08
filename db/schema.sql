-- Customs Categorization Portal – Supabase SQL
-- Run this in Supabase Dashboard → SQL Editor

-- 1. documents – uploaded packing list
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(30) NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL,
  original_file_url TEXT NOT NULL,
  original_file_name VARCHAR(255),
  file_type VARCHAR(20) NOT NULL,
  extracted_text TEXT,
  status VARCHAR(30) DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. document_items – each row detected from the original file
CREATE TABLE IF NOT EXISTS document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  raw_line TEXT NOT NULL,
  detected_description TEXT,
  detected_quantity INTEGER,
  detected_unit TEXT,
  line_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. item_classifications – AI output per item
CREATE TABLE IF NOT EXISTS item_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES document_items(id) ON DELETE CASCADE,
  ai_category VARCHAR(100),
  ai_hs_code VARCHAR(20),
  clean_description TEXT,
  confidence DECIMAL(5, 2),
  ai_raw_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. grouped_items – final HS-grouped result (assessor-style)
CREATE TABLE IF NOT EXISTS grouped_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  hs_code VARCHAR(20) NOT NULL,
  category VARCHAR(100) NOT NULL,
  final_description TEXT NOT NULL,
  total_quantity INTEGER NOT NULL,
  unit VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. hs_code_reference – optional lookup table (Phase 2)
CREATE TABLE IF NOT EXISTS hs_code_reference (
  hs_code VARCHAR(20) PRIMARY KEY,
  category VARCHAR(100),
  description TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_document_items_document_id ON document_items(document_id);
CREATE INDEX IF NOT EXISTS idx_item_classifications_item_id ON item_classifications(item_id);
CREATE INDEX IF NOT EXISTS idx_grouped_items_document_id ON grouped_items(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
