import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useClientCredits } from "@/hooks/use-client-credits";
import { formatDateBR, formatNumberBR } from "@/lib/format";

export const Route = createFileRoute("/app/creditos")({
  component: CreditosPage,
  head: () => ({
    meta: [
      { title: "Meus Créditos — Pratô" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Tx = {
  id: string;
  created_at: string;
  kind: string;
  delta: number;
  note: string | null;
  expires_at: string | null;
  package_id: string | null;
};

type PendingOrder = {
  id: string;
  created_at: string;
  package_name: string;
  credits_amount: number;
  status: string;
};

type Row =
  | { kind: "tx"; created_at: string; tx: Tx }
  | { kind: "pending"; created_at: string; order: PendingOrder };

function describe(kind: string, note: string | null): string {
  switch (kind) {
    case "purchase":
      return note?.trim() || "Compra de Pacote";
    case "consumption":
      return note?.trim() || "Agendamento";
    case "refund":
      return note?.trim() || "Estorno de agendamento";
    case "adjustment":
      return note?.trim() || "Ajuste";
    default:
      return note?.trim() || kind;
  }
}

function CreditosPage() {
  const { user } = useAuth();
  const { balance, loading: balanceLoading } = useClientCredits(user?.id);
  const [transactions, setTransactions] = useState<Tx[] | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const [{ data: txs }, { data: orders }] = await Promise.all([
        supabase
          .from("credit_transactions")
          .select("id, created_at, kind, delta, note, expires_at, package_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, created_at, package_name, credits_amount, status")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);
      if (cancel) return;
      setTransactions((txs ?? []) as Tx[]);
      setPendingOrders((orders ?? []) as PendingOrder[]);
      setLoading(false);
    })().catch(() => {
      if (!cancel) setLoading(false);
    });

    // Atualiza extrato em tempo real quando novas transações chegam
    const txChannel = supabase
      .channel(`credit_tx:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setTransactions((prev) => [payload.new as Tx, ...(prev ?? [])]);
        },
      )
      .subscribe();

    // Atualiza pedidos pendentes em tempo real
    const ordersChannel = supabase
      .channel(`orders:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as PendingOrder | null;
          const old = payload.old as { id?: string } | null;
          setPendingOrders((prev) => {
            const list = prev ?? [];
            if (payload.eventType === "DELETE") {
              return list.filter((o) => o.id !== old?.id);
            }
            if (next && next.status === "pending") {
              const without = list.filter((o) => o.id !== next.id);
              return [next, ...without];
            }
            // status mudou para algo diferente de pending → remove
            return list.filter((o) => o.id !== next?.id);
          });
        },
      )
      .subscribe();

    return () => {
      cancel = true;
      void supabase.removeChannel(txChannel);
      void supabase.removeChannel(ordersChannel);
    };
  }, [user]);

  const rows: Row[] = [
    ...(pendingOrders ?? []).map<Row>((order) => ({
      kind: "pending",
      created_at: order.created_at,
      order,
    })),
    ...(transactions ?? []).map<Row>((tx) => ({
      kind: "tx",
      created_at: tx.created_at,
      tx,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const isEmpty = !loading && rows.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          Meus Créditos
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Acompanhe seu saldo e o histórico de movimentações.
        </p>
      </header>

      {/* Saldo + CTA */}
      <Card className="flex flex-col items-start justify-between gap-4 border-0 bg-primary-soft p-6 shadow-card md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary/80">Saldo Atual</p>
            {balanceLoading ? (
              <Skeleton className="mt-2 h-12 w-28 bg-primary/10" />
            ) : (
              <p className="mt-1 text-5xl font-extrabold leading-none tracking-tight text-primary">
                {formatNumberBR(balance ?? 0)}
              </p>
            )}
            <p className="mt-1 text-sm text-primary/70">refeições disponíveis</p>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className="rounded-full bg-primary px-6 text-primary-foreground shadow-soft hover:bg-primary/90"
        >
          <Link to="/app/comprar">
            <Plus className="mr-1.5 h-4 w-4" />
            Comprar mais créditos
          </Link>
        </Button>
      </Card>

      {/* Extrato */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          Extrato de movimentações
        </h2>

        <Card className="border border-border/60 bg-card p-0 shadow-card">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Coins className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma movimentação encontrada.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link to="/app/comprar">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Comprar mais créditos
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Validade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  if (row.kind === "pending") {
                    const o = row.order;
                    return (
                      <TableRow key={`p-${o.id}`} className="bg-orange-50/50 hover:bg-orange-50">
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateBR(o.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 font-medium text-orange-700">
                              <Clock className="h-3.5 w-3.5" />
                              Compra de Pacote (Aguardando Pagamento)
                            </span>
                            <Button
                              asChild
                              variant="link"
                              size="sm"
                              className="h-auto w-fit p-0 text-xs text-orange-700 hover:text-orange-800"
                            >
                              <Link to="/pagamento" search={{ order: o.id }}>
                                Ver dados de pagamento
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-semibold text-muted-foreground">
                          {formatNumberBR(o.credits_amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          —
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const tx = row.tx;
                  const isIn = tx.delta > 0;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDateBR(tx.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {describe(tx.kind, tx.note)}
                      </TableCell>
                      <TableCell
                        className={
                          "whitespace-nowrap text-right text-sm font-semibold " +
                          (isIn ? "text-brand-green" : "text-orange-600")
                        }
                      >
                        {isIn ? "+" : ""}
                        {formatNumberBR(tx.delta)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {isIn && tx.expires_at
                          ? formatDateBR(tx.expires_at)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
