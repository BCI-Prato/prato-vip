import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package as PackageIcon, Inbox, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/format";
import type { Lead } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [activePackages, setActivePackages] = useState<number | null>(null);
  const [totalPackages, setTotalPackages] = useState<number | null>(null);
  const [leads7, setLeads7] = useState<number | null>(null);
  const [newLeads, setNewLeads] = useState<number | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [{ count: active }, { count: total }, { data: recent }, { count: novos }] = await Promise.all([
      supabase.from("packages").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("packages").select("id", { count: "exact", head: true }),
      supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo"),
    ]);
    setActivePackages(active ?? 0);
    setTotalPackages(total ?? 0);
    setNewLeads(novos ?? 0);

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { count: l7 } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since.toISOString());
    setLeads7(l7 ?? 0);
    setRecentLeads((recent ?? []) as Lead[]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        subtitle="Resumo do que está acontecendo na operação Pratô."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          title="Pacotes ativos"
          value={activePackages}
          hint={totalPackages !== null ? `de ${totalPackages} cadastrados` : undefined}
          icon={<PackageIcon className="h-4 w-4" />}
        />
        <KpiCard
          title="Leads novos"
          value={newLeads}
          hint="aguardando contato"
          icon={<Sparkles className="h-4 w-4" />}
          highlight
        />
        <KpiCard
          title="Leads (últimos 7 dias)"
          value={leads7}
          icon={<Inbox className="h-4 w-4" />}
        />
      </div>

      <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
        <header className="flex items-center justify-between border-b border-border/70 px-6 py-4">
          <div>
            <h2 className="font-semibold">Leads recentes</h2>
            <p className="text-sm text-muted-foreground">Últimas pessoas interessadas em conhecer a Pratô.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/clientes">Ver todos <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
          </Button>
        </header>
        {recentLeads.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nenhum lead ainda. Compartilhe a Landing Page para começar a receber contatos.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {recentLeads.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="font-medium">{l.full_name} <span className="text-muted-foreground">·</span> {l.company_name}</p>
                  <p className="text-sm text-muted-foreground">{l.email} · {l.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={l.status} />
                  <span className="text-xs text-muted-foreground">{formatDateBR(l.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  highlight,
}: {
  title: string;
  value: number | null;
  hint?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card p-5 shadow-soft ${
        highlight ? "border-primary/40 ring-1 ring-primary/15" : "border-border/70"
      }`}
    >
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{title}</span>
        <span className={`rounded-md p-1.5 ${highlight ? "bg-primary-soft text-primary" : "bg-secondary"}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 text-3xl font-extrabold">{value ?? "—"}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: Lead["status"] }) {
  const map: Record<Lead["status"], { label: string; cls: string }> = {
    novo: { label: "Novo", cls: "bg-primary-soft text-primary" },
    em_contato: { label: "Em contato", cls: "bg-warning/15 text-warning-foreground" },
    convertido: { label: "Convertido", cls: "bg-brand-green-soft text-brand-green" },
    descartado: { label: "Descartado", cls: "bg-secondary text-muted-foreground" },
  };
  return <Badge className={map[status].cls}>{map[status].label}</Badge>;
}
