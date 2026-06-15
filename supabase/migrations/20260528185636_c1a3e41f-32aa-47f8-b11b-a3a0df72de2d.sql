-- Revoke default PUBLIC execute on all SECURITY DEFINER functions, then re-grant
-- only where actually needed.

-- Trigger-only functions: no API caller should execute these directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_assign_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_client_credits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_admin_email_domain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_admin_field_changes_on_tickets() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies; PostgREST never calls it directly,
-- but RLS evaluation runs as the calling role, so anon and authenticated
-- must retain execute rights. Reset PUBLIC then grant explicitly.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- cnpj_exists is called by the public checkout form (anon).
REVOKE ALL ON FUNCTION public.cnpj_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cnpj_exists(text) TO anon, authenticated, service_role;

-- confirm_scheduled_deliveries is only called by authenticated clients.
REVOKE ALL ON FUNCTION public.confirm_scheduled_deliveries(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_scheduled_deliveries(jsonb) TO authenticated, service_role;