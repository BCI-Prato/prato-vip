CREATE TABLE public.delivery_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_delivery_id uuid NOT NULL REFERENCES public.scheduled_deliveries(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  company_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado','cancelado','entregue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheduled_delivery_id, employee_id)
);

CREATE INDEX idx_delivery_employees_company_date ON public.delivery_employees (company_id, delivery_date);
CREATE INDEX idx_delivery_employees_employee_date_status ON public.delivery_employees (employee_id, delivery_date, status);
CREATE INDEX idx_delivery_employees_scheduled ON public.delivery_employees (scheduled_delivery_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_employees TO authenticated;
GRANT ALL ON public.delivery_employees TO service_role;

ALTER TABLE public.delivery_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all delivery_employees"
  ON public.delivery_employees FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Companies view own delivery_employees"
  ON public.delivery_employees FOR SELECT
  TO authenticated
  USING (auth.uid() = company_id);

CREATE POLICY "Companies insert own delivery_employees"
  ON public.delivery_employees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Companies update own delivery_employees"
  ON public.delivery_employees FOR UPDATE
  TO authenticated
  USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Companies delete own delivery_employees"
  ON public.delivery_employees FOR DELETE
  TO authenticated
  USING (auth.uid() = company_id);