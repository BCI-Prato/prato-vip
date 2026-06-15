
-- 1. Update admin domain enforcement to accept only @pratoservicos.com
CREATE OR REPLACE FUNCTION public.enforce_admin_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_email TEXT;
BEGIN
  IF NEW.role = 'admin'::public.app_role THEN
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
    IF user_email IS NULL OR user_email NOT ILIKE '%@pratoservicos.com' THEN
      RAISE EXCEPTION 'Apenas e-mails do domínio @pratoservicos.com podem receber o papel admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on user_roles
DROP TRIGGER IF EXISTS enforce_admin_email_domain_trg ON public.user_roles;
CREATE TRIGGER enforce_admin_email_domain_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_email_domain();

-- 2. Auto-assign role on new user
CREATE OR REPLACE FUNCTION public.auto_assign_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email ILIKE '%@pratoservicos.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS auto_assign_user_role_trg ON auth.users;
CREATE TRIGGER auto_assign_user_role_trg
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_user_role();
