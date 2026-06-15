-- 1. Sanitize existing CNPJs (keep only digits)
UPDATE public.profiles
SET cnpj = regexp_replace(cnpj, '\D', '', 'g')
WHERE cnpj IS NOT NULL AND cnpj <> regexp_replace(cnpj, '\D', '', 'g');

-- Null out invalid CNPJs (not exactly 14 digits) so unique index can be created safely
UPDATE public.profiles
SET cnpj = NULL
WHERE cnpj IS NOT NULL AND length(cnpj) <> 14;

-- 2. Partial unique index on cnpj (ignores NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnpj_unique_idx
  ON public.profiles (cnpj)
  WHERE cnpj IS NOT NULL;

-- 3. Public RPC to check if a CNPJ already exists
CREATE OR REPLACE FUNCTION public.cnpj_exists(_cnpj text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE cnpj = regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')
      AND length(regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g')) = 14
  );
$$;

GRANT EXECUTE ON FUNCTION public.cnpj_exists(text) TO anon, authenticated;