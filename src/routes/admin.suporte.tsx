import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LifeBuoy, Loader2, CheckCircle2, Inbox, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";

export const Route = createFileRoute("/admin/suporte")({
  component: SupportAdminPage,
});

const SUBJECT_LABELS: Record<string, string> = {
  agendamento: "Dúvida sobre Agendamento",
  entrega: "Problema com a Entrega",
  financeiro: "Financeiro",
  outros: "Outros",
};

type TicketStatus = "pendente" | "em_andamento" | "resolvido";

type ThreadMessage = {
  sender: "admin" | "customer";
  text: string;
  created_at: string;
};

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  admin_reply: string | null;
  messages: ThreadMessage[];
  profile: {
    company_name: string | null;
    full_name: string | null;
    email: string | null;
  } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: TicketStatus) {
  if (status === "resolvido")
    return "border-brand-green/30 bg-brand-green-soft text-brand-green";
  if (status === "em_andamento")
    return "border-blue-300/60 bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  return "border-orange-300/60 bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300";
}

function statusLabel(status: TicketStatus) {
  if (status === "resolvido") return "Resolvido";
  if (status === "em_andamento") return "Em andamento";
  return "Pendente";
}

function SupportAdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"abertos" | "resolvido">("abertos");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState<"reply" | "resolve" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const filter =
      tab === "abertos" ? ["pendente", "em_andamento"] : ["resolvido"];
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, user_id, subject, message, status, created_at, resolved_at, admin_reply, messages",
      )
      .in("status", filter)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Falha ao carregar chamados.");
      setTickets([]);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set((data ?? []).map((t) => t.user_id)));
    let profilesById: Record<string, Ticket["profile"]> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, company_name, full_name, email")
        .in("id", userIds);
      profilesById = Object.fromEntries(
        (profs ?? []).map((p) => [
          p.id,
          {
            company_name: p.company_name,
            full_name: p.full_name,
            email: p.email,
          },
        ]),
      );
    }

    setTickets(
      (data ?? []).map((t) => ({
        ...t,
        status: t.status as TicketStatus,
        messages: Array.isArray(t.messages)
          ? (t.messages as unknown as ThreadMessage[])
          : [],
        profile: profilesById[t.user_id] ?? null,
      })),
    );
    setLoading(false);
  }, [tab]);

  const loadPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    setPendingCount(count ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadPendingCount();
  }, [loadPendingCount, tickets]);

  function openTicket(t: Ticket) {
    setActiveTicket(t);
    setReply("");
  }

  function closeTicket() {
    setActiveTicket(null);
    setReply("");
    setSubmitting(null);
  }

  const thread = useMemo<ThreadMessage[]>(() => {
    if (!activeTicket) return [];
    const initial: ThreadMessage = {
      sender: "customer",
      text: activeTicket.message,
      created_at: activeTicket.created_at,
    };
    return [initial, ...activeTicket.messages];
  }, [activeTicket]);

  async function submit(action: "reply" | "resolve") {
    if (!user || !activeTicket) return;
    const text = reply.trim();
    if (action === "reply" && text.length === 0) {
      toast.error("Escreva uma mensagem para enviar.");
      return;
    }
    setSubmitting(action);

    const newMessage: ThreadMessage | null =
      text.length > 0
        ? { sender: "admin", text, created_at: new Date().toISOString() }
        : null;
    const newMessages = newMessage
      ? [...activeTicket.messages, newMessage]
      : activeTicket.messages;

    const update =
      action === "resolve"
        ? {
            messages: newMessages as unknown as never,
            status: "resolvido",
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
            ...(text.length > 0 ? { admin_reply: text } : {}),
          }
        : {
            messages: newMessages as unknown as never,
            status: "em_andamento",
            ...(text.length > 0 && !activeTicket.admin_reply
              ? { admin_reply: text }
              : {}),
          };

    const { error } = await supabase
      .from("support_tickets")
      .update(update)
      .eq("id", activeTicket.id);

    setSubmitting(null);
    if (error) {
      toast.error("Não foi possível salvar. Tente novamente.");
      return;
    }
    toast.success(
      action === "resolve" ? "Chamado resolvido." : "Resposta enviada.",
    );
    setTickets((prev) => prev.filter((t) => t.id !== activeTicket.id));
    closeTicket();
    void load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <PageHeader
          title="Suporte"
          subtitle="Chamados enviados pelos clientes."
          actions={
            pendingCount > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </Badge>
            ) : undefined
          }
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="abertos">Em aberto</TabsTrigger>
          <TabsTrigger value="resolvido">Resolvidos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card p-10 text-center">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {tab === "abertos"
                  ? "Nenhum chamado em aberto."
                  : "Nenhum chamado resolvido."}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tickets.map((t) => {
                const company =
                  t.profile?.company_name ||
                  t.profile?.full_name ||
                  "Cliente sem nome";
                const replyCount = t.messages.length;
                return (
                  <li
                    key={t.id}
                    className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {company}
                        </p>
                        {t.profile?.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {t.profile.email}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(t.status)}
                        >
                          {statusLabel(t.status)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {SUBJECT_LABELS[t.subject] ?? t.subject}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(t.created_at)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm text-foreground">
                      {t.message}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {replyCount === 0
                          ? "Sem respostas"
                          : `${replyCount} ${replyCount === 1 ? "mensagem" : "mensagens"} na thread`}
                      </p>
                      {tab === "abertos" ? (
                        <Button size="sm" onClick={() => openTicket(t)}>
                          Ver / Responder
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTicket(t)}
                        >
                          Ver conversa
                        </Button>
                      )}
                    </div>

                    {tab === "resolvido" && t.resolved_at && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Resolvido em {formatDate(t.resolved_at)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!activeTicket}
        onOpenChange={(open) => {
          if (!open) closeTicket();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pr-12">
            <DialogTitle>
              {activeTicket
                ? SUBJECT_LABELS[activeTicket.subject] ?? activeTicket.subject
                : "Chamado"}
            </DialogTitle>
            <DialogDescription>
              {activeTicket?.profile?.company_name ||
                activeTicket?.profile?.full_name ||
                "Cliente"}
            </DialogDescription>
            {activeTicket?.status !== "resolvido" && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-brand-green/30 bg-brand-green-soft/40 px-3 py-2">
                <p className="text-xs text-foreground">
                  Atendimento concluído? Encerre o chamado.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-brand-green/40 text-brand-green hover:bg-brand-green-soft"
                  onClick={() => void submit("resolve")}
                  disabled={submitting !== null}
                >
                  {submitting === "resolve" ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                  )}
                  Resolver chamado
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
            {thread.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col",
                  m.sender === "admin" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-soft",
                    m.sender === "admin"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-card text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                  {m.sender === "admin" ? "Pratô" : "Cliente"} •{" "}
                  {formatDate(m.created_at)}
                </p>
              </div>
            ))}
          </div>

          {activeTicket?.status !== "resolvido" && (
            <div className="space-y-2">
              <Label htmlFor="reply">Nova resposta</Label>
              <Textarea
                id="reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Escreva uma resposta para o cliente..."
                rows={4}
                maxLength={2000}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {activeTicket?.status !== "resolvido" ? (
              <Button
                onClick={() => void submit("reply")}
                disabled={submitting !== null || reply.trim().length === 0}
              >
                {submitting === "reply" ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3.5 w-3.5" />
                )}
                Enviar resposta
              </Button>
            ) : (
              <Button variant="outline" onClick={closeTicket}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
