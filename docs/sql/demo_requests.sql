-- Demo request leads (run in Supabase SQL Editor)
-- Stores "Get free demo" form submissions from the landing page.

CREATE TABLE IF NOT EXISTS public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  full_name varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  company varchar(255) NOT NULL,
  phone varchar(50),
  job_title varchar(120),
  monthly_volume varchar(50),
  message text,
  status varchar(30) NOT NULL DEFAULT 'new',
  source varchar(80) NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_email
  ON public.demo_requests (email);

CREATE INDEX IF NOT EXISTS idx_demo_requests_created_at
  ON public.demo_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_requests_status
  ON public.demo_requests (status);

-- Optional: keep updated_at in sync on row changes
CREATE OR REPLACE FUNCTION public.set_demo_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_demo_requests_updated_at ON public.demo_requests;

CREATE TRIGGER trg_demo_requests_updated_at
  BEFORE UPDATE ON public.demo_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_demo_requests_updated_at();

-- Match other app tables: service role / backend inserts via DATABASE_URL
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service" ON public.demo_requests;

CREATE POLICY "Allow all for service"
  ON public.demo_requests
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.demo_requests IS 'Landing page demo / contact form submissions';
