
-- ===== Enum de papéis =====
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- ===== Tabela profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== Tabela user_roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ===== Função has_role (security definer evita recursão) =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ===== Trigger: restringe role admin ao domínio @pratoservicos =====
CREATE OR REPLACE FUNCTION public.enforce_admin_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  IF NEW.role = 'admin'::public.app_role THEN
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    IF user_email IS NULL OR (
      user_email NOT ILIKE '%@pratoservicos.com.br'
      AND user_email NOT ILIKE '%@pratoservicos.com'
    ) THEN
      RAISE EXCEPTION 'Apenas e-mails do domínio @pratoservicos podem receber o papel admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_admin_email_domain_trigger
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_email_domain();

-- ===== Trigger: cria profile automaticamente =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Função utilitária: updated_at =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===== Tabela packages =====
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  highlight_tag TEXT,
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
  price_per_meal_text TEXT NOT NULL,
  advantage_description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER packages_updated_at
BEFORE UPDATE ON public.packages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX packages_active_order_idx
ON public.packages (is_active, display_order);

-- ===== Tabela leads =====
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  accepted_terms_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','em_contato','convertido','descartado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX leads_status_created_idx
ON public.leads (status, created_at DESC);

-- ===== RLS Policies =====

-- profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- packages
CREATE POLICY "Anyone can view active packages"
ON public.packages FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all packages"
ON public.packages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage packages"
ON public.packages FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- leads
CREATE POLICY "Anyone can submit leads"
ON public.leads FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view leads"
ON public.leads FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leads"
ON public.leads FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leads"
ON public.leads FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- ===== Seed: pacotes iniciais =====
INSERT INTO public.packages (name, highlight_tag, credits_amount, total_price, price_per_meal_text, advantage_description, is_active, display_order) VALUES
('Bronze', NULL, 50, 1250.00, 'R$ 25,00 por refeição', 'Pacote ideal para times pequenos. Inclui suporte por e-mail e relatórios mensais de consumo.', true, 1),
('Prata', 'Mais escolhido', 120, 2880.00, 'R$ 24,00 por refeição', 'O preferido das equipes em crescimento. Suporte prioritário, cardápio personalizável e relatório quinzenal de consumo.', true, 2),
('Ouro', 'Melhor benefício', 250, 5750.00, 'R$ 23,00 por refeição', 'Para empresas que querem o máximo. Gerente de conta dedicado, cardápio totalmente personalizado, relatórios semanais e brindes para o time.', true, 3);
