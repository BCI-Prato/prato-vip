
-- Revoga execução pública das funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_admin_email_domain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
-- has_role precisa ser chamável por usuários autenticados nas policies RLS
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Substitui policy permissiva de INSERT em leads por validação real
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;

CREATE POLICY "Anyone can submit valid leads"
ON public.leads FOR INSERT
WITH CHECK (
  status = 'novo'
  AND length(full_name) BETWEEN 2 AND 120
  AND length(company_name) BETWEEN 2 AND 160
  AND length(email) BETWEEN 5 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(phone) BETWEEN 8 AND 30
  AND (message IS NULL OR length(message) <= 2000)
  AND accepted_terms_at IS NOT NULL
  AND accepted_terms_at <= now()
);
