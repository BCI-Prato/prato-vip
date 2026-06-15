import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isDayEditable, ymdToScheduledForIso } from "./scheduling";

const itemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employee_ids: z.array(z.string().uuid()).max(500),
});

const inputSchema = z.object({
  items: z.array(itemSchema).min(1).max(31),
});

export type ConfirmSchedulingResult =
  | { ok: true; newBalance: number; debited: number; refunded: number }
  | {
      ok: false;
      reason: "blocked_day" | "insufficient" | "error" | "min_meals";
      message?: string;
    };

export const confirmScheduling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<ConfirmSchedulingResult> => {
    const { supabase } = context;

    // 1) validações por dia
    for (const it of data.items) {
      if (!isDayEditable(it.date)) {
        return {
          ok: false,
          reason: "blocked_day",
          message: `O dia ${it.date} não pode mais ser editado.`,
        };
      }
      const n = it.employee_ids.length;
      if (n > 0 && n < 3) {
        return {
          ok: false,
          reason: "min_meals",
          message: `O dia ${it.date} tem ${n} funcionário(s). Mínimo é 3 (ou 0 para cancelar).`,
        };
      }
      // dedup defensivo
      const unique = new Set(it.employee_ids);
      if (unique.size !== it.employee_ids.length) {
        return {
          ok: false,
          reason: "error",
          message: `Funcionário duplicado no dia ${it.date}.`,
        };
      }
    }

    // 2) RPC existente trata o débito/estorno FIFO de créditos
    const rpcItems = data.items.map((it) => ({
      date: it.date,
      meals_count: it.employee_ids.length,
    }));

    const { data: result, error } = await supabase.rpc(
      "confirm_scheduled_deliveries",
      { _items: rpcItems },
    );

    if (error) {
      console.error("[scheduling] rpc error", JSON.stringify(error));
      return {
        ok: false,
        reason: "error",
        message: `Erro ao processar agendamento: ${error.message ?? "desconhecido"}`,
      };
    }

    const rpcResult = result as ConfirmSchedulingResult;
    if (!rpcResult.ok) return rpcResult;

    // 3) sincroniza delivery_employees por dia (substitui o conjunto)
    for (const it of data.items) {
      // remove os registros atuais da empresa neste dia (RLS: company_id = auth.uid())
      const { error: delErr } = await supabase
        .from("delivery_employees")
        .delete()
        .eq("company_id", context.userId)
        .eq("delivery_date", it.date);
      if (delErr) {
        console.error("[scheduling] delete delivery_employees error");
        continue;
      }

      if (it.employee_ids.length === 0) continue;

      // localiza a scheduled_delivery vigente para este dia
      const { data: delivery, error: dErr } = await supabase
        .from("scheduled_deliveries")
        .select("id")
        .eq("user_id", context.userId)
        .eq("status", "scheduled")
        .eq("scheduled_for", ymdToScheduledForIso(it.date))
        .maybeSingle();

      if (dErr || !delivery) {
        console.error("[scheduling] delivery not found for", it.date);
        continue;
      }

      const rows = it.employee_ids.map((eid) => ({
        scheduled_delivery_id: delivery.id,
        employee_id: eid,
        delivery_date: it.date,
        company_id: context.userId,
        status: "confirmado",
      }));

      const { error: insErr } = await supabase
        .from("delivery_employees")
        .insert(rows);
      if (insErr) {
        console.error("[scheduling] insert delivery_employees error");
      }
    }

    return rpcResult;
  });
