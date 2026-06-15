
-- 1. Profiles: add company_name and phone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Update handle_new_user trigger to capture company_name and phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, company_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, public.profiles.company_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill profiles from leads (most recent lead per email)
UPDATE public.profiles p
SET
  company_name = COALESCE(p.company_name, l.company_name),
  phone = COALESCE(p.phone, l.phone)
FROM (
  SELECT DISTINCT ON (email) email, company_name, phone
  FROM public.leads
  ORDER BY email, created_at DESC
) l
WHERE lower(p.email) = lower(l.email)
  AND (p.company_name IS NULL OR p.phone IS NULL);

-- 4. client_credits: aggregated balance per user
CREATE TABLE public.client_credits (
  user_id UUID PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits" ON public.client_credits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all credits" ON public.client_credits
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage credits" ON public.client_credits
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. credit_transactions: source of truth
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.packages(id),
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('purchase','consumption','adjustment')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id, created_at DESC);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage transactions" ON public.credit_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: recalculate balance on insert
CREATE OR REPLACE FUNCTION public.recalc_client_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(delta), 0) INTO new_balance
  FROM public.credit_transactions
  WHERE user_id = NEW.user_id;

  INSERT INTO public.client_credits (user_id, balance, updated_at)
  VALUES (NEW.user_id, new_balance, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance,
        updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalc_client_credits() FROM PUBLIC;

CREATE TRIGGER trg_recalc_credits
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.recalc_client_credits();

-- 6. scheduled_deliveries
CREATE TABLE public.scheduled_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  meals_count INTEGER NOT NULL CHECK (meals_count > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','delivered','canceled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_deliveries_user ON public.scheduled_deliveries(user_id, scheduled_for);
ALTER TABLE public.scheduled_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deliveries" ON public.scheduled_deliveries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own deliveries" ON public.scheduled_deliveries
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'scheduled');
CREATE POLICY "Users update own scheduled deliveries" ON public.scheduled_deliveries
  FOR UPDATE USING (auth.uid() = user_id AND status = 'scheduled')
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scheduled deliveries" ON public.scheduled_deliveries
  FOR DELETE USING (auth.uid() = user_id AND status = 'scheduled');
CREATE POLICY "Admins manage deliveries" ON public.scheduled_deliveries
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_scheduled_deliveries_updated_at
  BEFORE UPDATE ON public.scheduled_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. consumption_history
CREATE TABLE public.consumption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  delivery_id UUID REFERENCES public.scheduled_deliveries(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meals_count INTEGER NOT NULL CHECK (meals_count > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consumption_history_user ON public.consumption_history(user_id, consumed_at DESC);
ALTER TABLE public.consumption_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own history" ON public.consumption_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage history" ON public.consumption_history
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
