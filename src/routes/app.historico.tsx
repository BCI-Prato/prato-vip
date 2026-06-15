import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumberBR } from "@/lib/format";

export const Route = createFileRoute("/app/historico")({
  component: HistoricoPage,
});

type Delivery = {
  id: string;
  scheduled_for: string;
  meals_count: number;
};

function HistoricoPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("scheduled_deliveries")
        .select("id, scheduled_for, meals_count")
        .eq("user_id", user.id)
        .eq("status", "delivered")
        .order("scheduled_for", { ascending: false });
      if (cancel) return;
      setItems(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Histórico de Consumo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Refeições já entregues à sua equipe.
        </p>
      </header>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma refeição consumida ainda.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border/60">
          {items.map((it) => {
            const d = new Date(it.scheduled_for);
            return (
              <div
                key={it.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {d.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.toLocaleDateString("pt-BR", { weekday: "long" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {formatNumberBR(it.meals_count)}{" "}
                    {it.meals_count === 1 ? "marmita" : "marmitas"}
                  </span>
                  <Badge className="bg-brand-green/15 text-brand-green hover:bg-brand-green/20">
                    Consumido
                  </Badge>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
