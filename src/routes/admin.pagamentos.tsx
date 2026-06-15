import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { listPendingOrders, approveOrder } from "@/lib/orders.functions";
import { formatBRL, formatDateBR, formatNumberBR } from "@/lib/format";
import { PageHeader } from "@/components/admin/PageHeader";

type PendingOrder = {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  credits_amount: number;
  total_price: number;
  created_at: string;
  status: string;
  profile: { company_name: string | null; full_name: string | null; email: string | null };
};

export const Route = createFileRoute("/admin/pagamentos")({
  component: AdminPagamentosPage,
  head: () => ({
    meta: [
      { title: "Pagamentos — Admin Pratô" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminPagamentosPage() {
  const list = useServerFn(listPendingOrders);
  const approve = useServerFn(approveOrder);

  const [orders, setOrders] = useState<PendingOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingOrder | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada.");
        setLoading(false);
        return;
      }
      const result = await list({ headers: { Authorization: `Bearer ${token}` } });
      if (!result.ok) {
        toast.error(`Falha ao carregar pedidos: ${("message" in result && result.message) || result.reason}`);
        setOrders([]);
      } else {
        setOrders(result.orders as PendingOrder[]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  async function handleApprove(order: PendingOrder) {
    setPendingId(order.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada.");
        return;
      }
      const result = await approve({
        data: { order_id: order.id },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!result.ok) {
        toast.error(`Não foi possível aprovar: ${("message" in result && result.message) || result.reason}`);
        return;
      }
      toast.success(
        `Pagamento aprovado! ${order.credits_amount} créditos liberados.`,
      );
      setOrders((prev) => prev?.filter((o) => o.id !== order.id) ?? null);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar pagamento.");
    } finally {
      setPendingId(null);
      setConfirm(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Pagamentos pendentes"
        subtitle="Aprove os pedidos após confirmar o recebimento via PIX ou Boleto. Os créditos são injetados automaticamente no saldo do cliente."
      />

      <Card className="border border-border/60 bg-card p-0 shadow-card">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhum pagamento pendente no momento.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Pacote</TableHead>
                <TableHead className="text-right">Marmitas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">
                      {o.profile.company_name || o.profile.full_name || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.profile.email || ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{o.package_name}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-foreground">
                    {formatNumberBR(o.credits_amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-foreground">
                    {formatBRL(o.total_price)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateBR(o.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => setConfirm(o)}
                      disabled={pendingId === o.id}
                      className="bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
                    >
                      {pendingId === o.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Aprovar Pagamento
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aprovação?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? (
                <>
                  Isso vai marcar o pedido como pago e liberar{" "}
                  <strong>{formatNumberBR(confirm.credits_amount)}</strong> créditos
                  para <strong>{confirm.profile.company_name || confirm.profile.full_name || confirm.profile.email}</strong>.
                  Esta ação não pode ser desfeita.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void handleApprove(confirm);
              }}
              className="bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
            >
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
