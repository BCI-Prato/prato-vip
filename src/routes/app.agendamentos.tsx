import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Coins,
  CheckCircle2,
  AlertTriangle,
  UtensilsCrossed,
  Info,
  Pencil,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNumberBR } from "@/lib/format";
import {
  brtParts,
  formatYmdRange,
  formatYmdShort,
  getWeekDays,
  isDayEditable,
  isToday,
  MIN_MEALS_PER_DAY,
} from "@/lib/scheduling";
import { confirmScheduling } from "@/lib/scheduling.functions";
import type { MenuRow } from "@/lib/menus.functions";
import {
  EmployeeSelectionDialog,
  type EmployeeOption,
} from "@/components/app/EmployeeSelectionDialog";

export const Route = createFileRoute("/app/agendamentos")({
  component: AgendamentosPage,
});

type DeliveryEmployeeRow = {
  employee_id: string;
  delivery_date: string;
};

function AgendamentosPage() {
  const { user } = useAuth();
  const confirmFn = useServerFn(confirmScheduling);

  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduledByYmd, setScheduledByYmd] = useState<Record<string, number>>({});
  const [confirmedEmployeesByYmd, setConfirmedEmployeesByYmd] = useState<
    Record<string, string[]>
  >({});
  const [menusByYmd, setMenusByYmd] = useState<Record<string, MenuRow>>({});
  const [draftEmployees, setDraftEmployees] = useState<Record<string, string[]>>({});
  const [loadedWeeks, setLoadedWeeks] = useState<Set<number>>(new Set());
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [openModalYmd, setOpenModalYmd] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  // carrega funcionários ativos uma vez
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, department")
        .eq("company_id", user.id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      setEmployees(
        (data ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          department: e.department,
        })),
      );
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const alreadyLoaded = loadedWeeks.has(weekOffset);
    let cancel = false;
    setLoading(true);
    (async () => {
      const start = `${weekDays[0]}T00:00:00.000Z`;
      const endDate = new Date(`${weekDays[weekDays.length - 1]}T00:00:00.000Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end = endDate.toISOString();

      const deliveriesQ = await supabase
        .from("scheduled_deliveries")
        .select("scheduled_for, meals_count, status")
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gte("scheduled_for", start)
        .lt("scheduled_for", end);
      const creditsQ = !alreadyLoaded
        ? await supabase
            .from("client_credits")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle()
        : null;
      const menusQ = await supabase
        .from("menus")
        .select("id, menu_date, base, proteins, sides, salads, dessert")
        .in("menu_date", weekDays);
      const deRowsQ = await supabase
        .from("delivery_employees")
        .select("employee_id, delivery_date")
        .eq("company_id", user.id)
        .eq("status", "confirmado")
        .in("delivery_date", weekDays);

      if (cancel) return;

      const deliveries = deliveriesQ.data ?? [];
      const credits = creditsQ?.data ?? null;
      const menus = (menusQ.data ?? []) as MenuRow[];
      const deRows = (deRowsQ.data ?? []) as DeliveryEmployeeRow[];

      const weekScheduled: Record<string, number> = {};
      for (const ymd of weekDays) weekScheduled[ymd] = 0;
      for (const d of deliveries) {
        const ymd = brtParts(new Date(d.scheduled_for)).ymd;
        weekScheduled[ymd] = (weekScheduled[ymd] ?? 0) + d.meals_count;
      }

      const weekConfirmedEmployees: Record<string, string[]> = {};
      for (const ymd of weekDays) weekConfirmedEmployees[ymd] = [];
      for (const r of deRows) {
        if (!weekConfirmedEmployees[r.delivery_date]) {
          weekConfirmedEmployees[r.delivery_date] = [];
        }
        weekConfirmedEmployees[r.delivery_date].push(r.employee_id);
      }

      setScheduledByYmd((prev) => ({ ...prev, ...weekScheduled }));
      setConfirmedEmployeesByYmd((prev) => ({
        ...prev,
        ...weekConfirmedEmployees,
      }));
      setMenusByYmd((prev) => {
        const next = { ...prev };
        for (const m of menus) next[m.menu_date] = m;
        return next;
      });
      // NÃO inicializa draftEmployees com confirmed: draft representa SOMENTE
      // alterações pendentes da sessão atual. Dias não editados ficam ausentes
      // do mapa e não entram no cálculo de "Esta confirmação".
      if (credits) setBalance(credits.balance ?? 0);
      setLoadedWeeks((s) => {
        const n = new Set(s);
        n.add(weekOffset);
        return n;
      });
      setLoading(false);
    })().catch(() => {
      if (!cancel) setLoading(false);
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekOffset]);

  // Agregação GLOBAL — usa SOMENTE os dias que o usuário editou nesta sessão
  // (chaves presentes em draftEmployees). Registros legados em
  // scheduled_deliveries SEM vínculo em delivery_employees são ignorados.
  function sameSet(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    for (const x of b) if (!s.has(x)) return false;
    return true;
  }

  const { totalDebit, totalRefund, changedDays } = useMemo(() => {
    let d = 0;
    let r = 0;
    let cd = 0;
    for (const ymd of Object.keys(draftEmployees)) {
      const cur = draftEmployees[ymd] ?? [];
      const confirmed = confirmedEmployeesByYmd[ymd] ?? [];
      if (sameSet(cur, confirmed)) continue;
      cd += 1;
      const delta = cur.length - confirmed.length;
      if (delta > 0) d += delta;
      else if (delta < 0) r += -delta;
    }
    return { totalDebit: d, totalRefund: r, changedDays: cd };
  }, [draftEmployees, confirmedEmployeesByYmd]);

  const netDelta = totalDebit - totalRefund;
  const balanceAfter = balance - netDelta;
  const insufficient = netDelta > 0 && balance < netDelta;
  const hasChanges = changedDays > 0;

  const invalidDays = useMemo(() => {
    const out: Array<{ ymd: string; count: number }> = [];
    for (const ymd of Object.keys(draftEmployees)) {
      const cur = (draftEmployees[ymd] ?? []).length;
      if (cur > 0 && cur < MIN_MEALS_PER_DAY) out.push({ ymd, count: cur });
    }
    return out;
  }, [draftEmployees]);
  const hasInvalidDay = invalidDays.length > 0;

  function setDayEmployees(ymd: string, ids: string[]) {
    setDraftEmployees((prev) => ({ ...prev, [ymd]: ids }));
  }

  async function handleConfirm() {
    if (!hasChanges || insufficient || submitting) return;
    setSubmitting(true);
    try {
      const items: Array<{ date: string; employee_ids: string[] }> = [];
      for (const ymd of Object.keys(draftEmployees)) {
        const curIds = draftEmployees[ymd] ?? [];
        const confirmedIds = confirmedEmployeesByYmd[ymd] ?? [];
        if (sameSet(curIds, confirmedIds)) continue;
        if (!isDayEditable(ymd)) continue;
        items.push({ date: ymd, employee_ids: curIds });
      }
      if (items.length === 0) {
        toast.info("Nenhuma alteração editável para confirmar.");
        return;
      }
      const res = await confirmFn({ data: { items } });
      if (!res.ok) {
        console.error("[agendamentos] confirm failed", res);
        if (res.reason === "insufficient") {
          toast.error("Saldo insuficiente para confirmar.");
        } else if (res.reason === "blocked_day") {
          toast.error(res.message ?? "Um dos dias não pode mais ser editado.");
        } else if (res.reason === "min_meals") {
          toast.error(res.message ?? "Mínimo de 3 funcionários por dia.");
        } else {
          toast.error(res.message ?? "Não foi possível confirmar. Tente novamente.");
        }
        return;
      }
      toast.success(
        totalDebit && totalRefund
          ? `Confirmado! ${totalDebit} crédito(s) usados, ${totalRefund} estornado(s).`
          : totalDebit
            ? `Confirmado! ${totalDebit} crédito(s) usados.`
            : `Confirmado! ${totalRefund} crédito(s) estornados.`,
      );
      setBalance(res.newBalance);
      setScheduledByYmd((prev) => {
        const next = { ...prev };
        for (const it of items) next[it.date] = it.employee_ids.length;
        return next;
      });
      setConfirmedEmployeesByYmd((prev) => {
        const next = { ...prev };
        for (const it of items) next[it.date] = it.employee_ids;
        return next;
      });
      // limpa o draft dos dias confirmados — eles passam a fazer parte do
      // estado "confirmado" e não devem mais aparecer como pendentes.
      setDraftEmployees((prev) => {
        const next = { ...prev };
        for (const it of items) delete next[it.date];
        return next;
      });
    } catch (e) {
      console.error("[agendamentos] confirm error", e);
      const msg = e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const employeesById = useMemo(() => {
    const m = new Map<string, EmployeeOption>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-32">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Agendamentos
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Selecione os funcionários que vão receber marmita em cada dia. Você pode preencher várias semanas e confirmar tudo de uma vez.
        </p>
      </header>

      <Card className="flex items-center gap-4 border-0 bg-primary-soft p-5 shadow-card">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Coins className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary/70">
            Saldo de Créditos
          </p>
          <p className="text-2xl font-extrabold leading-none text-primary">
            {formatNumberBR(balance)}
          </p>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Semana
          </p>
          <p className="text-lg font-semibold">
            {formatYmdRange(weekDays[0], weekDays[weekDays.length - 1])}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => w - 1)}
            disabled={weekOffset <= 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Semana anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            Semana seguinte
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          O cardápio da semana seguinte é atualizado todas as quintas-feiras.
        </p>
        <p className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Edição encerrada com 24h de antecedência. Quantidade mínima por dia: 3 (ou 0 para cancelar).
        </p>
        <p className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Pedidos de emergência podem ser solicitados das 08h às 11h do dia da entrega exclusivamente pelo nosso WhatsApp.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {weekDays.map((ymd) => {
            const scheduled = scheduledByYmd[ymd] ?? 0;
            const selectedIds =
              draftEmployees[ymd] ?? confirmedEmployeesByYmd[ymd] ?? [];
            const editable = isDayEditable(ymd);
            return (
              <DayCard
                key={ymd}
                ymd={ymd}
                scheduled={scheduled}
                selectedIds={selectedIds}
                employeesById={employeesById}
                editable={editable}
                onOpenModal={() => setOpenModalYmd(ymd)}
                menu={menusByYmd[ymd]}
                belowMin={
                  selectedIds.length > 0 && selectedIds.length < MIN_MEALS_PER_DAY
                }
              />
            );
          })}
        </div>
      )}

      {/* Modal de seleção (compartilhado) */}
      {openModalYmd && (
        <EmployeeSelectionDialog
          open={!!openModalYmd}
          onOpenChange={(o) => !o && setOpenModalYmd(null)}
          title={`Quem vai receber marmita em ${formatYmdShort(openModalYmd)}?`}
          employees={employees}
          initialSelected={
            draftEmployees[openModalYmd] ??
            confirmedEmployeesByYmd[openModalYmd] ??
            []
          }
          onConfirm={(ids) => setDayEmployees(openModalYmd, ids)}
        />
      )}

      {/* Rodapé fixo */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Saldo atual: </span>
            <span className="font-semibold">{formatNumberBR(balance)}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Esta confirmação: </span>
            <span
              className={
                netDelta > 0
                  ? "font-semibold text-primary"
                  : netDelta < 0
                    ? "font-semibold text-brand-green"
                    : "font-semibold text-foreground"
              }
            >
              {netDelta > 0 ? "−" : netDelta < 0 ? "+" : "±"}
              {formatNumberBR(Math.abs(netDelta))}
            </span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">Saldo após: </span>
            <span
              className={
                balanceAfter < 0
                  ? "font-semibold text-destructive"
                  : "font-semibold"
              }
            >
              {formatNumberBR(balanceAfter)}
            </span>
            {changedDays > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {changedDays} dia(s) com alterações pendentes (em todas as semanas).
              </div>
            )}
            {insufficient && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Saldo insuficiente
              </div>
            )}
            {hasInvalidDay && (
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Pedido mínimo de 3 marmitas por dia não atingido em {invalidDays.length} dia(s).
              </div>
            )}
          </div>
          <Button
            size="lg"
            onClick={() => void handleConfirm()}
            disabled={!hasChanges || insufficient || submitting || hasInvalidDay}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirmar Agendamentos
          </Button>
        </div>
      </div>
    </div>
  );
}

function DayCard({
  ymd,
  scheduled,
  selectedIds,
  employeesById,
  editable,
  onOpenModal,
  menu,
  belowMin,
}: {
  ymd: string;
  scheduled: number;
  selectedIds: string[];
  employeesById: Map<string, EmployeeOption>;
  editable: boolean;
  onOpenModal: () => void;
  menu?: MenuRow;
  belowMin?: boolean;
}) {
  const today = isToday(ymd);
  const cleanedMenu = menu ? cleanMenu(menu) : null;
  const hasMenu = !!cleanedMenu && menuHasContent(cleanedMenu);
  const count = selectedIds.length;
  const names = selectedIds
    .map((id) => employeesById.get(id)?.name ?? "")
    .filter(Boolean);
  const visible = names.slice(0, 2);
  const extra = names.length - visible.length;

  return (
    <Card
      className={`flex min-h-[200px] flex-col gap-3 p-4 ${
        editable ? "border-border/70" : "border-border/40 bg-muted/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold capitalize">
            {formatYmdShort(ymd)}
          </p>
          {!editable && scheduled > 0 && (
            <p className="text-xs text-muted-foreground">
              Já agendado: {scheduled}
            </p>
          )}
        </div>
        {(today || !editable) && (
          <div className="flex flex-col items-end gap-1">
            {today && (
              <Badge className="bg-brand-green-soft text-brand-green">Hoje</Badge>
            )}
            {!editable && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" /> Bloqueado
              </Badge>
            )}
          </div>
        )}
      </div>

      {editable ? (
        count === 0 ? (
          <div className="flex flex-1 items-center">
            <Button
              variant="outline"
              onClick={onOpenModal}
              className="h-auto w-full whitespace-normal border-primary bg-background py-3 text-primary hover:bg-primary-soft hover:text-primary"
            >
              <UserPlus className="mr-2 h-4 w-4 shrink-0" />
              Selecionar funcionários
            </Button>
          </div>
        ) : (
          <div className="rounded-xl bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {count}
                </p>
                <p className="text-xs text-muted-foreground">
                  funcionário{count === 1 ? "" : "s"}
                </p>
                <div className="mt-2 space-y-0.5">
                  {visible.map((n, i) => (
                    <p key={i} className="truncate text-xs text-foreground">
                      {n}
                    </p>
                  ))}
                  {extra > 0 && (
                    <p className="text-xs text-muted-foreground">
                      e mais {extra}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-primary hover:bg-primary-soft hover:text-primary"
                onClick={onOpenModal}
                aria-label="Editar seleção"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      ) : (
        scheduled === 0 && (
          <p className="text-xs text-muted-foreground">
            Edição encerrada com 24h de antecedência.
          </p>
        )
      )}

      {belowMin && editable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Faltam {MIN_MEALS_PER_DAY - count} funcionário{MIN_MEALS_PER_DAY - count > 1 ? "s" : ""} para atingir o pedido mínimo diário de {MIN_MEALS_PER_DAY}.
          </span>
        </div>
      )}

      {hasMenu && cleanedMenu && (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto justify-start gap-1.5 px-1 py-1 text-xs font-medium text-primary hover:bg-transparent hover:text-primary/80"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Ver cardápio do dia
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="capitalize">
                Cardápio · {formatYmdShort(ymd)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <MenuSection label="Base" items={cleanedMenu.base ? [cleanedMenu.base] : []} />
              <MenuSection label="Proteínas" items={cleanedMenu.proteins} />
              <MenuSection label="Acompanhamentos" items={cleanedMenu.sides} />
              <MenuSection label="Saladas" items={cleanedMenu.salads} />
              <MenuSection label="Sobremesa" items={cleanedMenu.dessert ? [cleanedMenu.dessert] : []} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function cleanMenu(m: MenuRow) {
  const trim = (s: string) => (s ?? "").trim();
  const arr = (xs: string[]) => (xs ?? []).map(trim).filter((s) => s.length > 0);
  return {
    base: trim(m.base),
    proteins: arr(m.proteins),
    sides: arr(m.sides),
    salads: arr(m.salads),
    dessert: trim(m.dessert),
  };
}

function menuHasContent(m: ReturnType<typeof cleanMenu>) {
  return (
    m.base.length > 0 ||
    m.dessert.length > 0 ||
    m.proteins.length > 0 ||
    m.sides.length > 0 ||
    m.salads.length > 0
  );
}

function MenuSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
