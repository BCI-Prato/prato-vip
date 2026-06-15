
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS bonuses TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Recalcula saldo considerando apenas créditos válidos
CREATE OR REPLACE FUNCTION public.recalc_client_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(delta), 0) INTO new_balance
  FROM public.credit_transactions
  WHERE user_id = NEW.user_id
    AND (expires_at IS NULL OR expires_at > now());

  INSERT INTO public.client_credits (user_id, balance, updated_at)
  VALUES (NEW.user_id, new_balance, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance,
        updated_at = now();
  RETURN NEW;
END;
$function$;

-- Substitui pacotes
DELETE FROM public.packages;

INSERT INTO public.packages (name, credits_amount, total_price, price_per_meal_text, highlight_tag, advantage_description, bonuses, display_order, is_active) VALUES
('PACOTE 100', 100, 2490.00, 'R$ 24,90/marmita', NULL,
 'Ideal para começar a cuidar da nutrição do seu time.',
 ARRAY['Diagnóstico de gestão para o gestor','Diagnóstico Flex de Clima Organizacional','Relatório para o gestor'],
 1, true),
('PACOTE 200', 200, 4980.00, 'R$ 24,90/marmita', NULL,
 'Mais marmitas e um benefício extra para liderança.',
 ARRAY['Tudo do PACOTE 100','Análise do perfil comportamental do líder com uma devolutiva'],
 2, true),
('PACOTE 500', 500, 12450.00, 'R$ 24,90/marmita', 'MAIS POPULAR',
 'O preferido das equipes em crescimento.',
 ARRAY['Tudo do PACOTE 200','Palestra sobre perfil para o time'],
 3, true),
('PACOTE 1.000', 1000, 24900.00, 'R$ 24,90/marmita', 'PREMIUM',
 'A experiência completa para empresas que querem o máximo.',
 ARRAY['Tudo do PACOTE 500','Avaliação de perfil com até 10 colaboradores','Acesso à Comunidade Bem estar com dicas semanais'],
 4, true);
