import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createPendingOrder } from "@/lib/orders.functions";
import { formatBRL, formatNumberBR } from "@/lib/format";
import type { Package } from "@/lib/types";

export const Route = createFileRoute("/app/comprar")({
  component: ComprarPage,
  head: () => ({
    meta: [
      { title: "Comprar créditos — Pratô" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ComprarPage() {
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const createOrder = useServerFn(createPendingOrder);

  useEffect(() => {
    void supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data }) => setPackages((data ?? []) as Package[]));
  }, []);

  async function handleSelect(pkg: Package) {
    if (pendingId) return;
    setPendingId(pkg.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const result = await createOrder({
        data: { package_id: pkg.id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!result.ok) {
        console.error("[orders] create failed:", result);
        toast.error("Não foi possível criar o pedido. Tente novamente.");
        return;
      }
      void navigate({ to: "/pagamento", search: { order: result.order_id } });
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Comprar mais créditos
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Escolha um pacote para adicionar mais marmitas ao seu saldo. Os dados
          da sua conta já serão usados automaticamente.
        </p>
      </header>

      {packages === null ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[460px] animate-pulse rounded-3xl border border-border/70 bg-card"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <p className="text-center text-muted-foreground">
          Nenhum pacote disponível no momento.
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onSelect={() => handleSelect(pkg)}
              loading={pendingId === pkg.id}
              disabled={!!pendingId && pendingId !== pkg.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageCard({
  pkg,
  onSelect,
  loading,
  disabled,
}: {
  pkg: Package;
  onSelect: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const featured = !!pkg.highlight_tag;
  const isPremium = pkg.highlight_tag?.toUpperCase() === "PREMIUM";

  return (
    <div
      className={`relative flex flex-col rounded-3xl border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card ${
        featured
          ? isPremium
            ? "border-brand-green/50 ring-1 ring-brand-green/30"
            : "border-primary/40 ring-1 ring-primary/20"
          : "border-border/70"
      }`}
    >
      {pkg.highlight_tag && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
            isPremium
              ? "bg-brand-green text-brand-green-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {pkg.highlight_tag}
        </span>
      )}
      <h3 className="mt-1 text-center text-sm text-muted-foreground">
        {pkg.name}
      </h3>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        <span
          className={`block text-5xl font-bold ${
            isPremium ? "text-brand-green" : "text-orange-500"
          }`}
        >
          {formatNumberBR(pkg.credits_amount)}
        </span>
        marmitas
      </p>
      <div className="mt-4">
        <div className="text-center text-2xl font-extrabold text-foreground">
          {formatBRL(pkg.total_price)}
        </div>
        <div className="mt-1 text-center text-sm text-muted-foreground">
          {pkg.price_per_meal_text}
        </div>
      </div>
      {!!(pkg.features?.length ? pkg.features : pkg.bonuses)?.length && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p
            className={`text-center text-xs font-semibold uppercase tracking-wider ${
              isPremium ? "text-brand-green" : "text-primary"
            }`}
          >
            Bônus inclusos
          </p>
          <ul className="mt-3 space-y-2">
            {(pkg.features?.length ? pkg.features : pkg.bonuses).map((b, i) => (
              <li key={i} className="flex gap-2 text-xs text-foreground/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto pt-6">
        <Button
          onClick={onSelect}
          disabled={loading || disabled}
          className={`w-full ${
            featured
              ? isPremium
                ? "bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-foreground text-background hover:bg-foreground/90"
          }`}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Selecionar pacote
        </Button>
      </div>
    </div>
  );
}
