import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verifica se o usuário autenticado já era cliente antes deste login.
 * O userId é obtido do JWT verificado (não aceita input do cliente).
 *
 * Regra: se a diferença entre `created_at` e `last_sign_in_at` for menor que
 * ~15 segundos, consideramos signup (não signin). Nesse caso, removemos o
 * usuário recém-criado e retornamos `allowed: false`.
 */
export const verifyExistingUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: result, error } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (error || !result?.user) {
      return { allowed: false as const, reason: "not_found" as const };
    }
    const user = result.user;
    const created = new Date(user.created_at).getTime();
    const lastSignIn = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).getTime()
      : created;
    const diffSeconds = Math.abs(lastSignIn - created) / 1000;
    const isFreshSignup = diffSeconds < 15;
    if (isFreshSignup) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      return { allowed: false as const, reason: "signup_blocked" as const };
    }
    return {
      allowed: true as const,
      email: user.email ?? null,
    };
  });
