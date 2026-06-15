import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Copy, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatNumberBR } from "@/lib/format";

const searchSchema = z.object({
  order: z.string().uuid().optional(),
  pacote: z.string().uuid().optional(),
});

const PIX_KEY = "30.433.877/0001-37";
const BANK = "C6 Bank";
const WHATSAPP_PHONE = "5547996183794";

type OrderInfo = {
  id: string;
  package_name: string;
  credits_amount: number;
  total_price: number;
};

export const Route = createFileRoute("/pagamento")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PagamentoPage,
  head: () => ({
    meta: [
      { title: "Pagamento — Pratô" },
      {
        name: "description",
        content:
          "Conclua o pagamento do seu pacote Pratô para liberar seus créditos.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PagamentoPage() {
  const { order: orderId, pacote } = Route.useSearch();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (orderId) {
        const { data } = await supabase
          .from("orders")
          .select("id, package_name, credits_amount, total_price")
          .eq("id", orderId)
          .maybeSingle();
        if (cancel) return;
        setOrder(data as OrderInfo | null);
      } else if (pacote) {
        const { data } = await supabase
          .from("packages")
          .select("name, credits_amount, total_price")
          .eq("id", pacote)
          .maybeSingle();
        if (cancel) return;
        if (data) {
          setOrder({
            id: pacote,
            package_name: data.name,
            credits_amount: data.credits_amount,
            total_price: Number(data.total_price),
          });
        }
      }
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [orderId, pacote]);

  const packageLabel = order
    ? `${formatNumberBR(order.credits_amount)} marmitas (${order.package_name})`
    : "marmitas";

  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    `Olá! Gerei um pedido do pacote de ${packageLabel} e gostaria de enviar o comprovante PIX ou solicitar o Boleto.`,
  )}`;

  function copyPix() {
    void navigator.clipboard.writeText(PIX_KEY).then(() => {
      toast.success("Chave PIX copiada!");
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 md:px-6 md:py-20">
          <div className="w-full rounded-3xl border border-border/70 bg-card p-8 shadow-soft md:p-10">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green/15">
                <CheckCircle2 className="h-8 w-8 text-brand-green" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight md:text-3xl">
                Pedido criado com sucesso!
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Realize o pagamento abaixo para que liberemos seus créditos.
              </p>
            </div>

            {/* Resumo */}
            {loading ? (
              <div className="mt-6 h-20 animate-pulse rounded-2xl bg-muted" />
            ) : order ? (
              <div className="mt-6 rounded-2xl border border-border/60 bg-secondary/40 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Pacote
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {order.package_name} — {formatNumberBR(order.credits_amount)} marmitas
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Valor: <span className="font-semibold text-foreground">{formatBRL(order.total_price)}</span>
                </p>
              </div>
            ) : null}

            {/* Dados PIX */}
            <div className="mt-6 space-y-4 rounded-2xl border border-border/60 p-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Banco
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{BANK}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Chave PIX (CNPJ)
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
                    {PIX_KEY}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyPix}
                    aria-label="Copiar chave PIX"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Para pagamento via PIX, faça a transferência e envie o comprovante
                no nosso WhatsApp. Para pagamento via Boleto, solicite a emissão
                pelo WhatsApp.
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className="mt-6 w-full bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-5 w-5" />
                Falar com o Financeiro
              </a>
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Após o envio do comprovante, a nossa equipe fará a liberação dos
              seus créditos no painel.
            </p>

            <div className="mt-8 text-center">
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Ir para o painel do cliente
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </di