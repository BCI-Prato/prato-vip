import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Phone, Building2, MessageSquare, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateBR } from "@/lib/format";
import type { Lead, LeadSource, LeadStatus, Package } from "@/lib/types";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/clientes")({
  component: AdminClientesPage,
});

const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  convertido: "Convertido",
  descartado: "Descartado",
};

function AdminClientesPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [{ data: l }, { data: p }] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*"),
    ]);
    setLeads((l ?? []) as Lead[]);
    setPackages((p ?? []) as Package[]);
  }

  const visible = useMemo(() => {
    if (!leads) return null;
    return filter === "all" ? leads : leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const pkgName = (id: string | null) =>
    id ? packages.find((p) => p.id === id)?.name ?? "Pacote removido" : "—";

  async function updateStatus(lead: Lead, status: LeadStatus) {
    if (lead.status === status) return;
    const previous = lead.status;
    setLeads((prev) =>
      prev ? prev.map((l) => (l.id === lead.id ? { ...l, status } : l)) : prev,
    );
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    if (error) {
      setLeads((prev) =>
        prev ? prev.map((l) => (l.id === lead.id ? { ...l, status: previous } : l)) : prev,
      );
      toast.error("Não foi possível atualizar o status");
      return;
    }
    toast.success("Status atualizado");
  }

  async function approvePayment(lead: Lead) {
    if (!lead.package_id) {
      toast.error("Este cliente não tem um pacote associado.");
      return;
    }
    setApprovingId(lead.id);
    try {
      const pkg = packages.find((p) => p.id === lead.package_id);
      if (!pkg) {
        toast.error("Pacote não encontrado.");
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", lead.email)
        .maybeSingle();
      if (profileErr) {
        toast.error("Erro ao localizar a conta do cliente.");
        return;
      }
      if (!profile) {
        toast.error("Cliente ainda não criou a conta com este e-mail.");
        return;
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6);

      const { error: txErr } = await supabase.from("credit_transactions").insert({
        user_id: profile.id,
        package_id: pkg.id,
        delta: pkg.credits_amount,
        kind: "purchase",
        expires_at: expiresAt.toISOString(),
        note: "Aprovação manual via painel admin",
      });
      if (txErr) {
        toast.error("Não foi possível registrar os créditos.");
        return;
      }

      // O saldo é recalculado automaticamente pelo trigger trg_recalc_credits
      // a partir da soma de credit_transactions. Não fazer upsert manual aqui
      // (causava contagem dupla → 200 ao invés de 100).

      const { error: statusErr } = await supabase
        .from("leads")
        .update({ status: "convertido" })
        .eq("id", lead.id);
      if (statusErr) {
        toast.error("Créditos liberados, mas o status do cliente não foi atualizado.");
        return;
      }

      toast.success("Pagamento aprovado e créditos liberados!");
      void load();
    } finally {
      setApprovingId(null);
    }
  }

  function exportCsv() {
    if (!visible || visible.length === 0) return;
    const headers = ["Data", "Nome", "Empresa", "E-mail", "Telefone", "Pacote", "Status", "Mensagem"];
    const rows = visible.map((l) => [
      formatDateBR(l.created_at),
      l.full_name,
      l.company_name,
      l.email,
      l.phone,
      pkgName(l.package_id),
      STATUS_LABEL[l.status],
      (l.message ?? "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-prato-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Gestão de clientes e leads recebidos pela Pratô."
        actions={
          <>
            <Select value={filter} onValueChange={(v) => setFilter(v as LeadStatus | "all")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="novo">Novos</SelectItem>
                <SelectItem value="em_contato">Em contato</SelectItem>
                <SelectItem value="convertido">Convertidos</SelectItem>
                <SelectItem value="descartado">Descartados</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={!visible || visible.length === 0}>
              Exportar CSV
            </Button>
          </>
        }
      />

      {visible === null ? (
        <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-16 text-center text-sm text-muted-foreground">
          Nenhum lead com esse filtro.
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((l) => (
            <article key={l.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{l.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{formatDateBR(l.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source={l.source} />
                  <Badge className="bg-secondary text-foreground">Pacote: {pkgName(l.package_id)}</Badge>
                  <StatusBadge status={l.status} />
                </div>
              </header>
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {l.company_name}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> <a href={`mailto:${l.email}`} className="hover:text-foreground">{l.email}</a>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {l.phone}
                </div>
              </div>
              {l.message && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-secondary p-3 text-sm">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="whitespace-pre-wrap">{l.message}</p>
                </div>
              )}
              {l.status === "novo" && l.package_id && (
                <div className="mt-4 flex justify-end border-t border-border/70 pt-4">
                  <Button
                    onClick={() => void approvePayment(l)}
                    disabled={approvingId === l.id}
                    className="bg-brand-green text-white hover:bg-brand-green/90"
                  >
                    {approvingId === l.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Aprovar Pagamento e Liberar Créditos
                  </Button>
                </div>
              )}
              <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                <span className="text-xs font-medium text-muted-foreground">Atualizar status:</span>
                {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={l.status === s ? "default" : "outline"}
                    onClick={() => void updateStatus(l, s)}
                    className={l.status === s ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                  >
                    {STATUS_LABEL[s]}
                  </Button>
                ))}
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, string> = {
    novo: "bg-primary-soft text-primary",
    em_contato: "bg-warning/15 text-warning-foreground",
    convertido: "bg-brand-green-soft text-brand-green",
    descartado: "bg-secondary text-muted-foreground",
  };
  return <Badge className={map[status]}>{STATUS_LABEL[status]}</Badge>;
}

function SourceBadge({ source }: { source: LeadSource | null | undefined }) {
  const s: LeadSource = source ?? "contact_form";
  const label = s === "checkout" ? "Cadastro/App" : "Formulário de Contato";
  const cls =
    s === "checkout"
      ? "bg-primary-soft text-primary"
      : "bg-secondary text-muted-foreground";
  return <Badge className={cls}>{label}</Badge>;
}
