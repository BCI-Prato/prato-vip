import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Coins, Plus, Clock, LifeBuoy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumberBR } from "@/lib/format";
import type { DashboardOverview } from "@/lib/dashboard.functions";
import { useClientCredits } from "@/hooks/use-client-credits";

type DashboardData = DashboardOverview & { deliveryTime: string | null };

export const Route = createFileRoute("/app/")({
  component: OverviewPage,
});

function OverviewPage() {
  const { user } = useAuth();
  const { balance: liveBalance } = useClientCredits(user?.id);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    setIsLoading(true);
    (async () => {
      const email = user.email ?? "";
      const [{ data: profile }, { data: credits }, { data: delivery }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("company_name, full_name, delivery_time")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("client_credits")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("scheduled_deliveries")
            .select("id, scheduled_for, meals_count")
            .eq("user_id", user.id)
            .eq("status", "scheduled")
            .gte("scheduled_for", new Date().toISOString())
            .order("scheduled_for", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);
      if (cancel) return;
      const dt = (profile as { delivery_time?: string | null } | null)?.delivery_time ?? null;
      setData({
        companyName:
          profile?.company_name?.trim() ||
          profile?.full_name?.trim() ||
          email.split("@")[0] ||
          "cliente",
        email,
        creditsBalance: credits?.balance ?? 0,
        nextDelivery: delivery ?? null,
        deliveryTime: dt ? dt.slice(0, 5) : null,
      });
      setIsLoading(false);
    })().catch(() => {
      if (!cancel) setIsLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [user]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          {isLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <span>Olá, {data?.companyName}</span>
          )}
        </h1>
        <p className="mt-2 text-muted-foreground text-xs">
          Bem-vindo ao seu painel de gestão.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Saldo de créditos — destaque */}
        <Card className="relative overflow-hidden border-0 bg-primary-soft p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-primary/80">
                Saldo de Créditos
              </p>
              {isLoading ? (
                <Skeleton className="mt-3 h-14 w-24 bg-primary/10" />
              ) : (
                <p className="mt-3 text-6xl font-extrabold leading-none tracking-tight text-primary">
                  {formatNumberBR(liveBalance ?? data?.creditsBalance ?? 0)}
                </p>
              )}
              <p className="mt-2 text-sm text-primary/70">
                refeições disponíveis
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Coins className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* Próxima entrega */}
        <Card className="border border-border/60 bg-card p-6 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Próxima Entrega
              </p>
              {isLoading ? (
                <Skeleton className="mt-3 h-8 w-40" />
              ) : data?.nextDelivery ? (
                <>
                  <p className="mt-3 text-2xl font-bold text-foreground">
                    {new Date(data.nextDelivery.scheduled_for).toLocaleDateString(
                      "pt-BR",
                      { day: "2-digit", month: "long" },
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatNumberBR(data.nextDelivery.meals_count)} refeições
                  </p>
                  {data.deliveryTime ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Horário: {data.deliveryTime} (Tolerância de 20 min)
                    </p>
                  ) : (
                    <Link
                      to="/app/configuracoes"
                      className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Definir horário de entrega
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    Nenhuma entrega agendada
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Crie um agendamento para começar.
                  </p>
                </>
              )}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-soft text-brand-green">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* CTA principal */}
      <Card className="flex flex-col items-start justify-between gap-4 border-0 bg-foreground/[0.03] p-6 shadow-none md:flex-row md:items-center">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Pronto para a próxima refeição?
          </h2>
          <p className="text-sm text-muted-foreground">
            Agende suas entregas e mantenha seu time bem alimentado.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="rounded-full bg-primary px-6 text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Link to="/app/agendamentos">
            <Plus className="mr-1.5 h-4 w-4" />
            Agendar Refeições
          </Link>
        </Button>
      </Card>

      {/* Atalhos */}
      <div className="grid gap-3 md:grid-cols-3">
        <ShortcutCard
          to="/app/creditos"
          icon={<Coins className="h-4 w-4" />}
          title="Meus Créditos"
          subtitle="Ver extrato de movimentações"
        />
        <ShortcutCard
          to="/app/historico"
          icon={<Clock className="h-4 w-4" />}
          title="Histórico"
          subtitle="Refeições já consumidas"
        />
        <ShortcutCard
          to="/app/suporte"
          icon={<LifeBuoy className="h-4 w-4" />}
          title="Suporte"
          subtitle="Fale com nosso time"
        />
      </div>
    </div>
  );
}

function ShortcutCard({
  to,
  icon,
  title,
  subtitle,
}: {
  to: "/app/creditos" | "/app/historico" | "/app/suporte";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 transition hover:border-primary/40 hover:shadow-soft"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary-soft group-hover:text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}
