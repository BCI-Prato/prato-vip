import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const registerRepurchaseIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ package_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("full_name, company_name, email, phone")
      .eq("id", context.userId)
      .maybeSingle();
    if (profErr) {
      console.error("[repurchase] profile fetch failed:", profErr.message);
      return {
        ok: false as const,
        reason: "profile_failed" as const,
        message: profErr.message,
      };
    }
    const email = profile?.email?.trim() || context.claims.email;
    if (!email) {
      return { ok: false as const, reason: "profile_missing" as const };
    }
    const phone = (profile?.phone ?? "").trim() || "00000000";
    const company = (profile?.company_name ?? "").trim() || "Empresa";
    const fullName =
      (profile?.full_name ?? "").trim() ||
      company ||
      "Cliente";
    const { error } = await supabaseAdmin.from("leads").insert({
      package_id: data.package_id,
      full_name: fullName,
      company_name: company,
      email,
      phone,
      message: "Recompra via app (cliente logado)",
      accepted_terms_at: new Date().toISOString(),
      source: "checkout",
      status: "convertido",
    });
    if (error) {
      console.error("[repurchase] lead insert failed:", error.message);
      return {
        ok: false as const,
        reason: "insert_failed" as const,
        message: error.message,
      };
    }
    return { ok: true as const };
  });

const inputSchema = z.object({
  package_id: z.string().uuid().nullable(),
  full_name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().min(2).max(160),
  cnpj: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(30),
  password: z.string().min(8).max(72),
  message: z.string().trim().max(2000).nullable().optional(),
});

const checkoutProfileSchema = inputSchema.omit({ password: true });

export const completeCheckoutProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => checkoutProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
      id: context.userId,
      full_name: data.full_name,
      email: data.email,
      company_name: data.company_name,
      phone: data.phone,
      cnpj: data.cnpj ?? null,
    });

    if (profileErr) {
      console.error("[checkout] profile upsert failed:", profileErr.message);
      return { ok: false as const, reason: "profile_failed" as const };
    }

    const { error: leadErr } = await supabaseAdmin.from("leads").insert({
      package_id: data.package_id,
      full_name: data.full_name,
      company_name: data.company_name,
      email: data.email,
      phone: data.phone,
      message: data.message ?? null,
      accepted_terms_at: new Date().toISOString(),
      source: "checkout",
      status: "convertido",
    });

    if (leadErr) {
      console.error("[checkout] lead insert failed:", leadErr.message);
      return { ok: false as const, reason: "lead_failed" as const };
    }

    return { ok: true as const };
  });

const onlyDigits = (v: string | null | undefined) =>
  (v ?? "").replace(/\D/g, "");

export const createClientAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const cnpjDigits = data.cnpj ? onlyDigits(data.cnpj) : null;
    const phoneDigits = onlyDigits(data.phone);

    // Pre-check CNPJ uniqueness to avoid creating an orphan auth user
    if (cnpjDigits && cnpjDigits.length === 14) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("cnpj", cnpjDigits)
        .maybeSingle();
      if (existing) {
        return { ok: false as const, reason: "cnpj_exists" as const };
      }
    }

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          company_name: data.company_name,
          phone: phoneDigits,
        },
      });

    if (createErr) {
      const msg = createErr.message?.toLowerCase() ?? "";
      if (
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists")
      ) {
        return { ok: false as const, reason: "email_exists" as const };
      }
      return {
        ok: false as const,
        reason: "create_failed" as const,
        message: createErr.message,
      };
    }

    const { error: leadErr } = await supabaseAdmin.from("leads").insert({
      package_id: data.package_id,
      full_name: data.full_name,
      company_name: data.company_name,
      email: data.email,
      phone: phoneDigits,
      message: data.message ?? null,
      accepted_terms_at: new Date().toISOString(),
      source: "checkout",
      status: "convertido",
    });

    if (leadErr) {
      console.error("[checkout] lead insert failed:", leadErr.message);
    }

    const userId = created?.user?.id;
    let orderId: string | null = null;
    if (userId) {
      const profileUpdate: { cnpj?: string; phone?: string } = { phone: phoneDigits };
      if (cnpjDigits) profileUpdate.cnpj = cnpjDigits;
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);
      if (profErr) {
        console.error("[checkout] profile update failed:", profErr.message, (profErr as { code?: string }).code);
        if ((profErr as { code?: string }).code === "23505") {
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return { ok: false as const, reason: "cnpj_exists" as const };
        }
      }

      if (data.package_id) {
        const { data: pkg } = await supabaseAdmin
          .from("packages")
          .select("id, name, credits_amount, total_price, is_active")
          .eq("id", data.package_id)
          .maybeSingle();
        if (pkg && pkg.is_active) {
          const { data: order, error: orderErr } = await supabaseAdmin
            .from("orders")
            .insert({
              user_id: userId,
              package_id: pkg.id,
              credits_amount: pkg.credits_amount,
              total_price: pkg.total_price,
              package_name: pkg.name,
              status: "pending",
            })
            .select("id")
            .single();
          if (orderErr) {
            console.error("[checkout] order insert failed:", orderErr.message);
          } else {
            orderId = order?.id ?? null;
          }
        }
      }
    }

    return { ok: true as const, email: data.email, order_id: orderId };
  });
