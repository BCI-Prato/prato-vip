ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'contact_form'
  CHECK (source IN ('contact_form', 'checkout'));