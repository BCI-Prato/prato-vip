CREATE TABLE public.menus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_date DATE NOT NULL UNIQUE,
  base TEXT NOT NULL DEFAULT '',
  proteins TEXT[] NOT NULL DEFAULT ARRAY[''::text, ''::text],
  sides TEXT[] NOT NULL DEFAULT ARRAY[''::text, ''::text],
  salads TEXT[] NOT NULL DEFAULT ARRAY[''::text, ''::text, ''::text],
  dessert TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menus_menu_date ON public.menus(menu_date);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage menus"
ON public.menus
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view menus"
ON public.menus
FOR SELECT
USING (true);

CREATE TRIGGER set_menus_updated_at
BEFORE UPDATE ON public.menus
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();