CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  identifier text NOT NULL,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX employees_company_identifier_unique
  ON public.employees (company_id, identifier);

CREATE INDEX employees_company_id_idx ON public.employees (company_id);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies view own employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (auth.uid() = company_id);

CREATE POLICY "Companies insert own employees"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Companies update own employees"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Companies delete own employees"
  ON public.employees FOR DELETE
  TO authenticated
  USING (auth.uid() = company_id);

CREATE POLICY "Admins manage all employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER employees_set_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();