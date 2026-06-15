import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPendingOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ package_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("id, name, credits_amount, total_price, is_active")
      .eq("id", data.package_id)
      .maybeSingle();
    if (pkgErr || !pkg || !pkg.is_active) {
      return { ok: false as const, reason: "package_not_found" as const };
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        package_id: pkg.id,
        credits_amount: pkg.credits_amount,
        total_price: pkg.total_price,
        package_name: pkg.name,
        status: "pending",
      })
      .select("id, package_name")
      .single();

    if (error || !order) {
      console.error("[orders] insert failed:", error?.message);
      return { ok: false as const, reason: "insert_failed" as const, message: error?.message };
    }

    return { ok: true as const, order_id: order.id, package_name: order.package_name };
  });

export const listPendingOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, package_id, package_name, credits_amount, total_price, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      return { ok: false as const, reason: "query_failed" as const, message: error.message };
    }

    const userIds = Array.from(new Set((orders ?? []).map((o) => o.user_id)));
    const profilesMap = new Map<string, { company_name: string | null; full_name: string | null; email: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, company_name, full_name, email")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profilesMap.set(p.id, { company_name: p.company_name, full_name: p.full_name, email: p.email });
      }
    }

    return {
      ok: true as const,
      orders: (orders ?? []).map((o) => ({
        ...o,
        profile: profilesMap.get(o.user_id) ?? { company_name: null, full_name: null, email: null },
      })),
    };
  });

export const approveOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ order_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, package_id, package_name, credits_amount, status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return { ok: false as const, reason: "order_not_found" as const };
    }
    if (order.status !== "pending") {
      return { ok: false as const, reason: "not_pending" as const };
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const { error: txErr } = await supabaseAdmin.from("credit_transactions").insert({
      user_id: order.user_id,
      package_id: order.package_id,
      delta: order.credits_amount,
      kind: "purchase",
      expires_at: expiresAt.toISOString(),
      note: `Compra de Pacote — ${order.package_name}`,
    });
    if (txErr) {
      console.error("[orders] credit_transactions insert failed:", txErr.message);
      return { ok: false as const, reason: "credit_failed" as const, message: txErr.message };
    }

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        approved_by: context.userId,
      })
      .eq("id", order.id);
    if (updErr) {
      console.error("[orders] update failed:", updErr.message);
      return { ok: false as const, reason: "update_failed" as const, message: updErr.message };
    }

    return { ok: true as const };
  });
