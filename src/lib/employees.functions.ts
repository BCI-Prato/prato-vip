import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Conta agendamentos futuros confirmados de um funcionário (da empresa logada).
 */
export const countFutureDeliveriesForEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ employee_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("delivery_employees")
      .select("id")
      .eq("employee_id", data.employee_id)
      .eq("company_id", context.userId)
      .eq("status", "confirmado")
      .gte("delivery_date", today);

    if (error) {
      console.error("[employees] count future error");
      return { ok: false as const, reason: "query_failed" as const };
    }
    return { ok: true as const, count: rows?.length ?? 0 };
  });

/**
 * Desativa funcionário e, se houver agendamentos futuros confirmados:
 *   - marca delivery_employees como 'cancelado'
 *   - reduz meals_count das entregas correspondentes (cancela se zerar)
 *   - estorna créditos via credit_transactions (kind='refund')
 *
 * Usa supabaseAdmin porque a inserção em credit_transactions é restrita
 * (apenas admins/RPCs definidos), mas validamos a posse antes de qualquer
 * escrita.
 */
export const deactivateEmployeeWithRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ employee_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // 1) valida que o funcionário pertence à empresa logada
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, company_id, is_active")
      .eq("id", data.employee_id)
      .maybeSingle();
    if (empErr || !emp) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (emp.company_id !== userId) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const today = new Date().toISOString().slice(0, 10);

    // 2) busca agendamentos futuros confirmados deste funcionário
    const { data: futureRecords, error: futErr } = await supabaseAdmin
      .from("delivery_employees")
      .select("id, scheduled_delivery_id, delivery_date")
      .eq("employee_id", data.employee_id)
      .eq("company_id", userId)
      .eq("status", "confirmado")
      .gte("delivery_date", today);

    if (futErr) {
      return { ok: false as const, reason: "query_failed" as const };
    }

    let refundedTotal = 0;

    if (futureRecords && futureRecords.length > 0) {
      // Agrupa por scheduled_delivery_id para saber quantos remover por entrega
      const groups = new Map<string, { count: number; date: string }>();
      for (const r of futureRecords) {
        const cur = groups.get(r.scheduled_delivery_id);
        if (cur) cur.count += 1;
        else groups.set(r.scheduled_delivery_id, { count: 1, date: r.delivery_date });
      }

      // 3) cancela os delivery_employees deste funcionário
      const ids = futureRecords.map((r) => r.id);
      const { error: cancelErr } = await supabaseAdmin
        .from("delivery_employees")
        .update({ status: "cancelado" })
        .in("id", ids);
      if (cancelErr) {
        return { ok: false as const, reason: "update_failed" as const };
      }

      // 4) para cada entrega: ajusta meals_count e gera estorno
      for (const [deliveryId, info] of groups.entries()) {
        const { data: delivery, error: dErr } = await supabaseAdmin
          .from("scheduled_deliveries")
          .select("id, meals_count, status")
          .eq("id", deliveryId)
          .maybeSingle();
        if (dErr || !delivery) continue;

        const newCount = Math.max(0, delivery.meals_count - info.count);
        if (newCount === 0) {
          await supabaseAdmin
            .from("scheduled_deliveries")
            .update({ status: "cancelled" })
            .eq("id", deliveryId);
        } else {
          await supabaseAdmin
            .from("scheduled_deliveries")
            .update({ meals_count: newCount })
            .eq("id", deliveryId);
        }

        // Estorno (trigger recalc_client_credits atualiza client_credits)
        const { error: txErr } = await supabaseAdmin
          .from("credit_transactions")
          .insert({
            user_id: userId,
            delta: info.count,
            kind: "adjustment",
            note: `Estorno por desativação de funcionário (${info.date})`,
          });
        if (!txErr) {
          refundedTotal += info.count;
        }
      }
    }

    // 5) desativa funcionário
    const { error: deactErr } = await supabaseAdmin
      .from("employees")
      .update({ is_active: false })
      .eq("id", data.employee_id);
    if (deactErr) {
      return { ok: false as const, reason: "deactivate_failed" as const };
    }

    // 6) saldo atualizado
    const { data: credits } = await supabaseAdmin
      .from("client_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      ok: true as const,
      refunded: refundedTotal,
      newBalance: credits?.balance ?? 0,
    };
  });
