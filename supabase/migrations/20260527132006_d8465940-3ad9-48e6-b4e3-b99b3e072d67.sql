CREATE OR REPLACE FUNCTION public.confirm_scheduled_deliveries(_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID := auth.uid();
  _item jsonb;
  _date_text TEXT;
  _new_count INTEGER;
  _scheduled_for TIMESTAMPTZ;
  _existing RECORD;
  _total_debit INTEGER := 0;
  _total_refund INTEGER := 0;
  _needed INTEGER := 0;
  _balance INTEGER := 0;
  _lot RECORD;
  _used INTEGER;
  _lot_remaining INTEGER;
  _take INTEGER;
  _remaining INTEGER;
  _debit_days TEXT := '';
  _new_balance INTEGER := 0;
  _delivery_at TIMESTAMPTZ;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 31 THEN
    RAISE EXCEPTION 'Lista de agendamentos inválida';
  END IF;

  CREATE TEMP TABLE _scheduling_ops (
    ymd DATE NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    new_count INTEGER NOT NULL,
    old_count INTEGER NOT NULL DEFAULT 0,
    existing_id UUID,
    delta INTEGER NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _date_text := _item->>'date';
    _new_count := (_item->>'meals_count')::integer;

    IF _date_text !~ '^\d{4}-\d{2}-\d{2}$' OR _new_count < 0 OR _new_count > 500 THEN
      RAISE EXCEPTION 'Item de agendamento inválido: %', _item::text;
    END IF;

    IF _new_count > 0 AND _new_count < 3 THEN
      RAISE EXCEPTION 'Quantidade mínima por dia é 3 (ou 0 para cancelar). Dia %.', _date_text;
    END IF;

    _scheduled_for := (_date_text::date + TIME '11:00') AT TIME ZONE 'America/Sao_Paulo';
    _delivery_at := _scheduled_for;

    IF now() >= _delivery_at - INTERVAL '24 hours' THEN
      RAISE EXCEPTION 'O dia % não pode mais ser editado (bloqueio 24h antes da entrega).', _date_text;
    END IF;

    SELECT id, meals_count
      INTO _existing
    FROM public.scheduled_deliveries
    WHERE user_id = _user_id
      AND status = 'scheduled'
      AND (scheduled_for AT TIME ZONE 'America/Sao_Paulo')::date = _date_text::date
    ORDER BY created_at DESC
    LIMIT 1;

    INSERT INTO _scheduling_ops (ymd, scheduled_for, new_count, old_count, existing_id, delta)
    VALUES (
      _date_text::date,
      _scheduled_for,
      _new_count,
      COALESCE(_existing.meals_count, 0),
      _existing.id,
      _new_count - COALESCE(_existing.meals_count, 0)
    );
  END LOOP;

  DELETE FROM _scheduling_ops WHERE delta = 0;

  SELECT COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0),
         COALESCE(SUM(-delta) FILTER (WHERE delta < 0), 0)
    INTO _total_debit, _total_refund
  FROM _scheduling_ops;

  IF _total_debit = 0 AND _total_refund = 0 THEN
    SELECT COALESCE(balance, 0) INTO _new_balance FROM public.client_credits WHERE user_id = _user_id;
    RETURN jsonb_build_object('ok', true, 'newBalance', COALESCE(_new_balance, 0), 'debited', 0, 'refunded', 0);
  END IF;

  _needed := GREATEST(0, _total_debit - _total_refund);

  SELECT COALESCE(balance, 0) INTO _balance FROM public.client_credits WHERE user_id = _user_id;

  IF _balance < _needed THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'message', 'Saldo insuficiente para confirmar.');
  END IF;

  IF _total_debit > 0 THEN
    SELECT string_agg(to_char(ymd, 'YYYY-MM-DD'), ', ' ORDER BY ymd) INTO _debit_days FROM _scheduling_ops WHERE delta > 0;
    _remaining := _total_debit;
    FOR _lot IN
      SELECT id, delta, package_id, expires_at, created_at
      FROM public.credit_transactions
      WHERE user_id = _user_id AND delta > 0 AND (expires_at IS NULL OR expires_at > now())
      ORDER BY expires_at ASC NULLS LAST, created_at ASC
    LOOP
      EXIT WHEN _remaining <= 0;
      SELECT COALESCE(SUM(-delta), 0) INTO _used
      FROM public.credit_transactions
      WHERE user_id = _user_id AND delta < 0
        AND (package_id IS NOT DISTINCT FROM _lot.package_id)
        AND (expires_at IS NOT DISTINCT FROM _lot.expires_at);
      _lot_remaining := _lot.delta - _used;
      CONTINUE WHEN _lot_remaining <= 0;
      _take := LEAST(_lot_remaining, _remaining);
      INSERT INTO public.credit_transactions (user_id, package_id, delta, kind, expires_at, note)
      VALUES (_user_id, _lot.package_id, -_take, 'consumption', _lot.expires_at, 'Agendamento ' || COALESCE(_debit_days, ''));
      _remaining := _remaining - _take;
    END LOOP;
    IF _remaining > 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente nos lotes de crédito disponíveis';
    END IF;
  END IF;

  INSERT INTO public.credit_transactions (user_id, delta, kind, expires_at, note)
  SELECT _user_id, -delta, 'adjustment', NULL, 'Estorno agendamento ' || to_char(ymd, 'YYYY-MM-DD')
  FROM _scheduling_ops
  WHERE delta < 0;

  UPDATE public.scheduled_deliveries sd
  SET status = 'cancelled'
  FROM _scheduling_ops op
  WHERE sd.id = op.existing_id AND op.new_count = 0;

  UPDATE public.scheduled_deliveries sd
  SET meals_count = op.new_count
  FROM _scheduling_ops op
  WHERE sd.id = op.existing_id AND op.new_count > 0;

  INSERT INTO public.scheduled_deliveries (user_id, scheduled_for, meals_count, status)
  SELECT _user_id, scheduled_for, new_count, 'scheduled'
  FROM _scheduling_ops
  WHERE existing_id IS NULL AND new_count > 0;

  SELECT COALESCE(balance, 0) INTO _new_balance FROM public.client_credits WHERE user_id = _user_id;

  RETURN jsonb_build_object('ok', true, 'newBalance', COALESCE(_new_balance, 0), 'debited', _total_debit, 'refunded', _total_refund);
END;
$function$;