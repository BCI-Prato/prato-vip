import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Loader2, Save, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  getMenusForWeek,
  upsertMenu,
  upsertMenuWeek,
  type MenuInput,
} from "@/lib/menus.functions";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return { Authorization: `Bearer ${token}` };
}

export const Route = createFileRoute("/admin/cardapio")({
  component: CardapioPage,
});

const DAY_LABELS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"];

function emptyDay(menu_date: string): MenuInput {
  return {
    menu_date,
    base: "",
    proteins: ["", ""],
    sides: ["", ""],
    salads: ["", "", ""],
    dessert: "",
  };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Returns Monday of the week containing `d`, in UTC.
function mondayOf(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc;
}

function todayBrtDate(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
}

function formatRange(monday: Date): string {
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${fmt(monday)} – ${fmt(friday)}`;
}

function formatDayShort(d: string): string {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
}

function isFilled(m: MenuInput): boolean {
  return Boolean(
    m.base.trim() ||
      m.dessert.trim() ||
      m.proteins.some((p) => p.trim()) ||
      m.sides.some((s) => s.trim()) ||
      m.salads.some((s) => s.trim()),
  );
}

function CardapioPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(todayBrtDate()));
  const [days, setDays] = useState<MenuInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [savingWeek, setSavingWeek] = useState(false);
  const [openItems, setOpenItems] = useState<string[]>([]);

  const fetchWeek = useServerFn(getMenusForWeek);
  const saveOne = useServerFn(upsertMenu);
  const saveWeek = useServerFn(upsertMenuWeek);

  const weekStartYmd = useMemo(() => ymd(weekStart), [weekStart]);
  const todayMonday = useMemo(() => ymd(mondayOf(todayBrtDate())), []);
  const isCurrentWeek = weekStartYmd === todayMonday;

  const load = useCallback(async () => {
    setLoading(true);
    // Always start with 5 empty weekdays so the UI renders even on error/empty.
    const start = new Date(`${weekStartYmd}T00:00:00Z`);
    const baseDates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      baseDates.push(d.toISOString().slice(0, 10));
    }
    const fallback = baseDates.map(emptyDay);
    setDays(fallback);

    try {
      const headers = await authHeaders();
      const result = await fetchWeek({ data: { weekStartYmd, days: 5 }, headers });
      const dates = result?.dates ?? baseDates;
      const menus = result?.menus ?? [];
      const byDate = new Map((menus ?? []).map((m) => [m.menu_date, m]));
      const loaded = (dates ?? baseDates).map((d) => {
        const found = byDate.get(d);
        return found
          ? {
              menu_date: d,
              base: found.base ?? "",
              proteins: [found.proteins?.[0] ?? "", found.proteins?.[1] ?? ""],
              sides: [found.sides?.[0] ?? "", found.sides?.[1] ?? ""],
              salads: [
                found.salads?.[0] ?? "",
                found.salads?.[1] ?? "",
                found.salads?.[2] ?? "",
              ],
              dessert: found.dessert ?? "",
            }
          : emptyDay(d);
      });
      setDays(loaded);
      // Expand only empty days; keep filled ones collapsed.
      const emptyKeys = loaded
        .map((d, i) => (isFilled(d) ? null : `day-${i}`))
        .filter((v): v is string => v !== null);
      setOpenItems(emptyKeys.length > 0 ? [emptyKeys[0]] : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar.";
      toast.error(msg);
      // keep the empty fallback so the form is still usable
    } finally {
      setLoading(false);
    }
  }, [fetchWeek, weekStartYmd]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(idx: number, partial: Partial<MenuInput>) {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...partial } : d)));
  }

  function patchArr(idx: number, key: "proteins" | "sides" | "salads", pos: number, value: string) {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        const next = [...d[key]];
        next[pos] = value;
        return { ...d, [key]: next };
      }),
    );
  }

  function shiftWeek(deltaWeeks: number) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
    setWeekStart(d);
  }

  async function handleSaveDay(idx: number) {
    setSavingIdx(idx);
    try {
      const headers = await authHeaders();
      await saveOne({ data: days[idx], headers });
      toast.success(`Cardápio de ${DAY_LABELS[idx]} salvo!`);
      // Colapsa o accordion deste dia ao salvar com sucesso.
      setOpenItems((prev) => prev.filter((v) => v !== `day-${idx}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      toast.error(msg);
    } finally {
      setSavingIdx(null);
    }
  }

  async function handleSaveWeek() {
    setSavingWeek(true);
    try {
      const headers = await authHeaders();
      await saveWeek({ data: { items: days }, headers });
      toast.success("Semana completa salva!");
      setOpenItems([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      toast.error(msg);
    } finally {
      setSavingWeek(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cardápio Semanal"
        subtitle="Defina o cardápio de cada dia da semana (segunda a sexta)."
        actions={
          <Button onClick={() => void handleSaveWeek()} disabled={loading || savingWeek}>
            {savingWeek ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar Semana Completa
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatRange(weekStart)}</span>
              {isCurrentWeek && (
                <Badge variant="secondary" className="ml-1">Semana Atual</Badge>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => shiftWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!isCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(mondayOf(todayBrtDate()))}
            >
              Voltar para hoje
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando cardápios…
        </div>
      ) : (
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="space-y-3"
        >
          {days.map((day, idx) => {
            const filled = isFilled(day);
            return (
              <AccordionItem
                key={day.menu_date}
                value={`day-${idx}`}
                className="rounded-xl border bg-card px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{DAY_LABELS[idx]}</span>
                      <span className="text-sm text-muted-foreground">
                        · {formatDayShort(day.menu_date)}
                      </span>
                    </div>
                    <Badge variant={filled ? "default" : "secondary"}>
                      {filled ? "Preenchido" : "Vazio"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 pb-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Base
                      </Label>
                      <Input
                        value={day.base}
                        onChange={(e) => patch(idx, { base: e.target.value })}
                        placeholder="Ex: Arroz Branco, Feijão Carioca"
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Proteínas
                      </Label>
                      <div className="mt-1.5 space-y-2">
                        {day.proteins.map((v, i) => (
                          <Input
                            key={i}
                            value={v}
                            onChange={(e) => patchArr(idx, "proteins", i, e.target.value)}
                            placeholder={`Proteína ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Acompanhamentos
                      </Label>
                      <div className="mt-1.5 space-y-2">
                        {day.sides.map((v, i) => (
                          <Input
                            key={i}
                            value={v}
                            onChange={(e) => patchArr(idx, "sides", i, e.target.value)}
                            placeholder={`Acompanhamento ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Saladas
                      </Label>
                      <div className="mt-1.5 grid gap-2 md:grid-cols-3">
                        {day.salads.map((v, i) => (
                          <Input
                            key={i}
                            value={v}
                            onChange={(e) => patchArr(idx, "salads", i, e.target.value)}
                            placeholder={`Salada ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Sobremesa
                      </Label>
                      <Input
                        value={day.dessert}
                        onChange={(e) => patch(idx, { dessert: e.target.value })}
                        placeholder="Ex: Gelatina, Fruta da estação"
                        className="mt-1.5"
                      />
                    </div>

                    <div className="md:col-span-2 flex justify-end pt-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleSaveDay(idx)}
                        disabled={savingIdx === idx}
                      >
                        {savingIdx === idx ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar Cardápio do Dia
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
