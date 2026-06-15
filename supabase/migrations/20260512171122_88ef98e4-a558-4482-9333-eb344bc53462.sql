REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.cnpj_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cnpj_exists(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.confirm_scheduled_deliveries(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_scheduled_deliveries(jsonb) TO authenticated;