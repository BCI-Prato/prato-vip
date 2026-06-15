import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Printer, ChefHat, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brtParts } from "@/lib/scheduling";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  getProductionOrders,
  markDeliveryStatus,
  type ProductionItem,
  type ProductionOrders,
} from "@/lib/production.functions";

export const Route = createFileRoute("/admin/producao")({
  component: ProducaoPage,
});

function dateToBrtYmd(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function todayBrtDate(): Date {
  const ymd = brtParts().ymd;
  return new Date(`${ymd}T12:00:00Z`);
}

async function getAuthHeader(): Promise<{ Authorization: string } | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function ProducaoPage() {
  const [date, setDate] = useState<Date>(todayBrtDate);
  const ymd = useMemo(() => dateToBrtYmd(date), [date]);
  const fetchOrders = useServerFn(getProductionOrders);
  const updateStatus = useServerFn(markDeliveryStatus);

  const [data, setData] = useState<ProductionOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        toast.error("Sessão expirada.");
        setData({ totalMeals: 0, totalClients: 0, items: [] });
        return;
      }
      const result = await fetchOrders({ data: { date: ymd }, headers });
      setData(result);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast.error(`Não foi possível carregar a produção: ${msg}`);
      setData({ totalMeals: 0, totalClients: 0, items: [] });
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, ymd]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(item: ProductionItem, next: "scheduled" | "delivered") {
    setPendingId(item.id);
    try {
      const headers = await getAuthHeader();
      if (!headers) {
        toast.error("Sessão expirada.");
        return;
      }
      await updateStatus({ data: { delivery_id: item.id, status: next }, headers });
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === item.id ? { ...it, status: next } : it,
              ),
            }
          : prev,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast.error(`Não foi possível atualizar: ${msg}`);
    } finally {
      setPendingId(null);
    }
  }

  const items = data?.items ?? [];
  const totalMeals = data?.totalMeals ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const todayYmd = brtParts().ymd;
  const isFutureDate = ymd > todayYmd;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Cabeçalho */}
      <PageHeader
        title="Ordem de Produção"
        subtitle="Lista operacional do dia para a cozinha e logística."
        className="no-print"
        actions={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "PPP", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir Ordem
            </Button>
          </>
        }
      />

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold">
          Ordem de Produção — {format(date, "PPPP", { locale: ptBR })}
        </h2>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 border-2 border-primary/40 bg-primary-soft/40">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-primary/10 p-4">
              <ChefHat className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Total de marmitas hoje
              </p>
              <p className="text-5xl font-bold leading-none text-primary">
                {loading ? "—" : totalMeals}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-secondary p-4">
              <Users className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Clientes
              </p>
              <p className="text-3xl font-semibold">{loading ? "—" : totalClients}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 text-center text-muted-foreground">
              Nenhuma produção agendada para esta data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Horário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="w-32 text-center">Marmitas</TableHead>
                  <TableHead className="w-44">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <ProductionRow
                    key={it.id}
                    item={it}
                    pending={pendingId === it.id}
                    disabled={isFutureDate}
                    onToggle={(next) => void handleToggle(it, next)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductionRow({
  item,
  pending,
  disabled,
  onToggle,
}: {
  item: ProductionItem;
  pending: boolean;
  disabled?: boolean;
  onToggle: (next: "scheduled" | "delivered") => void;
}) {
  const delivered = item.status === "delivered";
  return (
    <TableRow className={cn(delivered && "bg-muted/30")}>
      <TableCell className="font-mono text-base font-semibold">
        {item.delivery_time ?? "—"}
      </TableCell>
      <TableCell className="font-medium">{item.company_name}</TableCell>
      <TableCell className="text-center text-lg font-bold">{item.meals_count}</TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Switch
            checked={delivered}
            disabled={pending || disabled}
            onCheckedChange={(checked) => onToggle(checked ? "delivered" : "scheduled")}
            aria-label="Marcar como entregue"
            className="no-print"
          />
          <Badge variant={delivered ? "default" : "secondary"}>
            {delivered ? "Entregue" : "Pendente"}
          </Badge>
        </div>
      </TableCell>
    </TableRow>
  );
}
