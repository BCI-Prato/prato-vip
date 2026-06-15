import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardOverview = {
  companyName: string;
  email: string;
  creditsBalance: number;
  nextDelivery: {
    id: string;
    scheduled_for: string;
    meals_count: number;
  } | null;
};

export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardOverview> => {
    const { supabase, userId, claims } = context;
    const email = (claims.email as string | undefined) ?? "";

    const [{ data: profile }, { data: credits }, { data: delivery }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("company_name, full_name")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("client_credits")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("scheduled_deliveries")
          .select("id, scheduled_for, meals_count")
          .eq("user_id", userId)
          .eq("status", "scheduled")
          .gte("scheduled_for", new Date().toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

    return {
      companyName:
        profile?.company_name?.trim() ||
        profile?.full_name?.trim() ||
        email.split("@")[0] ||
        "cliente",
      email,
      creditsBalance: credits?.balance ?? 0,
      nextDelivery: delivery ?? null,
    };
  });
