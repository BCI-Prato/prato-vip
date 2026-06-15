import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Saldo de créditos do cliente, com atualização em tempo real
 * via Supabase Realtime na tabela client_credits.
 */
export function useClientCredits(userId: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    void supabase
      .from("client_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setBalance(data?.balance ?? 0);
        setLoading(false);
      });

    const channel = supabase
      .channel(`client_credits:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_credits",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as { balance?: number } | null)?.balance;
          if (typeof next === "number") setBalance(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { balance, loading };
}
