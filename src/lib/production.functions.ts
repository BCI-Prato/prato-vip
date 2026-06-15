import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProductionItem = {
  id: string;
  user_id: string;
  meals_count: number;
  status: string;
  scheduled_for: string;
  company_name: string;
  delivery_time: string | null;
};

export type ProductionOrders = {
  totalMeals: number;
  totalClients: number;
  items: ProductionItem[];
};

const dateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Janela [date 00:00 BRT, date+1 00:00 BRT) em UTC (BRT = UTC-3, sem DST).
function brtDayWindow(ymd: string): { start: string; end: string } {
  const start = new Date(`${ymd}T03:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export const getProductionOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => dateSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProductionOrders> => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { start, end } = brtDayWindow(data.date);

    const { data: deliveries, error } = await supabase
      .from("scheduled_deliveries")
      .select("id, user_id, meals_count, status, scheduled_for")
      .in("status", ["scheduled", "delivered"])
      .gte("scheduled_for", start)
      .lt("scheduled_for", end);

    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((deliveries ?? []).map((d) => d.user_id)));
    let profilesMap = new Map<
      string,
      { company_name: string | null; full_name: string | null; delivery_time: string | null }
    >();

    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, company_name, full_name, delivery_time")
        .in("id", userIds);
      if (profErr) throw new Error(profErr.message);
      profilesMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          {
            company_name: p.company_name,
            full_name: p.full_name,
            delivery_time: p.delivery_time,
          },
        ]),
      );
    }

    const items: ProductionItem[] = (deliveries ?? []).map((d) => {
      const p = profilesMap.get(d.user_id);
      const dt = p?.delivery_time ?? null;
      const companyName =
        p?.company_name?.trim() || p?.full_name?.trim() || "Cliente sem nome";
      return {
        id: d.id,
        user_id: d.user_id,
        meals_count: d.meals_count,
        status: d.status,
        scheduled_for: d.scheduled_for,
        company_name: companyName,
        delivery_time: dt ? dt.slice(0, 5) : null,
      };
    });

    items.sort((a, b) => {
      const at = a.delivery_time ?? "99:99";
      const bt = b.delivery_time ?? "99:99";
      if (at !== bt) return at < bt ? -1 : 1;
      return a.company_name.localeCompare(b.company_name, "pt-BR");
    });

    const totalMeals = items.reduce((sum, it) => sum + it.meals_count, 0);
    const totalClients = new Set(items.map((it) => it.user_id)).size;

    return { totalMeals, totalClients, items };
  });

const statusSchema = z.object({
  delivery_id: z.string().uuid(),
  status: z.enum(["scheduled", "delivered"]),
});

export const markDeliveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => statusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { error } = await supabase
      .from("scheduled_deliveries")
      .update({ status: data.status })
      .eq("id", data.delivery_id);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
