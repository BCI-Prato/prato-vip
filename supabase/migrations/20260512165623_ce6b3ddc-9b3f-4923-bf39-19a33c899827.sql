CREATE POLICY "Users insert own consumption/refund"
ON public.credit_transactions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND kind IN ('consumption','refund')
  AND (
    (kind = 'consumption' AND delta < 0)
    OR (kind = 'refund'      AND delta > 0)
  )
);