ALTER FUNCTION public.confirm_scheduled_deliveries(jsonb) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.confirm_scheduled_deliveries(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_scheduled_deliveries(jsonb) TO authenticated;