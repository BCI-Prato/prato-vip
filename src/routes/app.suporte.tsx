import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  MessageCircle,
  Loader2,
  CheckCircle2,
  Inbox,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/app/suporte")({
  component: SupportPage,
});

const SUBJECTS = [
  { value: "agendamento", label: "Dúvida sobre Agendamento" },
  { value: "entrega", label: "Problema com a Entrega" },
  { value: "financeiro", label: "Financeiro" },
  { value: "outros", label: "Outros" },
] as const;

const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.value, s.label]),
);

const schema = z.object({
  subject: z.enum(["agendamento", "entrega", "financeiro", "outros"]),
  message: z
    .string()
    .trim()
    .min(10, "Descreva com ao menos 10 caracteres.")
    .max(2000),
});

type TicketStatus = "pendente" | "em_andamento" | "resolvido";

type ThreadMessage = {
  sender: "admin" | "customer";
  text: string;
  created_at: string;
};

type MyTicket = {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  admin_reply: string | null;
  messages: ThreadMessage[];
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
  if (status === "em_andamento") return "Aguardando você";
  return "Pendente";
}

function SupportPage() {
  const { user } = useAuth();
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const [activeTicket, setActiveTicket] = useState<MyTicket | null>(null);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, subject, message, status, created_at, resolved_at, admin_reply, messages",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) {
      setTickets(
        (data ?? []).map((t) => ({
          ...t,
          status: t.status as TicketStatus,
          messages: Array.isArray(t.messages)
            ? (t.messages as unknown as ThreadMessage[])
            : [],
        })),
      );
    }
    setLoadingTickets(false);
  }, [user]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    const parsed = schema.safeParse({ subject, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: "pendente",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    toast.success("Chamado enviado com sucesso!");
    setSubject("");
    setMessage("");
    setSent(true);
    void loadTickets();
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

  async function sendCustomerReply() {
    if (!activeTicket || !user) return;
    const text = reply.trim();
    if (text.length === 0) return;
    setSendingReply(true);
    const newMessages = [
      ...activeTicket.messages,
      {
        sender: "customer" as const,
        text,
        created_at: new Date().toISOString(),
      },
    ];
    const { error } = await supabase
      .from("support_tickets")
      .update({
        messages: newMessages as unknown as never,
        status: "pendente",
      })
      .eq("id", activeTicket.id);
    setSendingReply(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    toast.success("Resposta enviada à equipe.");
    setReply("");
    setActiveTicket(null);
    void loadTickets();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green-soft text-brand-green">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Fale com a Pratô</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Envie sua mensagem e nossa equipe responderá em breve.
        </p>
      </div>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-border/70 bg-card p-6 text-center shadow-soft">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-green-soft text-brand-green">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Recebemos seu chamado
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nossa equipe responderá em breve.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setSent(false)}
          >
            Enviar outra mensagem
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
        >
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger id="subject">
                <SelectValue placeholder="Selecione um assunto" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva sua dúvida ou solicitação..."
              rows={6}
              maxLength={2000}
            />
            <p className="text-right text-xs text-muted-foreground">
              {message.length}/2000
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting || !subject || message.trim().length < 10}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar mensagem"
            )}
          </Button>
        </form>
      )}

      <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
        <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Para emergências com a entrega de hoje, chame no WhatsApp:{" "}
          <a
            href="https://wa.me/5547996183794"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline-offset-2 hover:underline"
          >
            (47) 99618-3794
          </a>
        </span>
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Meus chamados</h2>
        <p className="text-xs text-muted-foreground">
          Histórico das suas solicitações de suporte.
        </p>

        <div className="mt-4">
          {loadingTickets ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center">
              <Inbox className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Você ainda não enviou nenhum chamado.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {tickets.map((t) => (
                <AccordionItem
                  key={t.id}
                  value={t.id}
                  className="rounded-xl border border-border/70 bg-card px-4 shadow-soft"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2 pr-2 text-left">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {SUBJECT_LABELS[t.subject] ?? t.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(t.status)}
                      >
                        {statusLabel(t.status)}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-2">
                      <div className="space-y-2">
                        <div className="flex flex-col items-start">
                          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm text-foreground">
                            <p className="whitespace-pre-wrap">{t.message}</p>
                          </div>
                          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                            Você • {formatDate(t.created_at)}
                          </p>
                        </div>

                        {t.messages.map((m, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex flex-col",
                              m.sender === "admin"
                                ? "items-start"
                                : "items-end",
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                                m.sender === "admin"
                                  ? "rounded-bl-sm bg-brand-green-soft text-foreground"
                                  : "rounded-br-sm bg-muted text-foreground",
                              )}
                            >
                              <p className="whitespace-pre-wrap">{m.text}</p>
                            </div>
                            <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                              {m.sender === "admin" ? "Pratô" : "Você"} •{" "}
                              {formatDate(m.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {t.status === "em_andamento" && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setActiveTicket(t);
                            setReply("");
                          }}
                        >
                          <Send className="mr-2 h-3.5 w-3.5" />
                          Responder
                        </Button>
                      )}

                      {t.status === "resolvido" && t.resolved_at && (
                        <p className="text-xs text-muted-foreground">
                          Chamado encerrado em {formatDate(t.resolved_at)}.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </section>

      <Dialog
        open={!!activeTicket}
        onOpenChange={(open) => {
          if (!open) {
            setActiveTicket(null);
            setReply("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder chamado</DialogTitle>
            <DialogDescription>
              Sua mensagem será enviada à equipe da Pratô.
            </DialogDescription>
          </DialogHeader>

          {activeTicket && thread.length > 0 && (
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Última mensagem
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {thread[thread.length - 1]!.text}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customer-reply">Sua resposta</Label>
            <Textarea
              id="customer-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Escreva sua resposta..."
              rows={5}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActiveTicket(null);
                setReply("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void sendCustomerReply()}
              disabled={sendingReply || reply.trim().length === 0}
            >
              {sendingReply ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Enviar resposta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
