import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createClientAccount } from "@/lib/checkout.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, formatNumberBR } from "@/lib/format";
import { maskCNPJ, maskPhone, onlyDigits } from "@/lib/masks";
import type { Package } from "@/lib/types";

const searchSchema = z.object({
  pacote: z.string().uuid().optional(),
});

const checkoutSchema = z.object({
  company_name: z.string().trim().min(2, "Informe o nome da empresa").max(160),
  cnpj: z
    .string()
    .refine((v) => onlyDigits(v).length === 14, "CNPJ deve ter 14 dígitos"),
  phone: z
    .string()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 11, "Telefone inválido"),
  email: z.string().trim().email("E-mail inválido").max(254),
  password: z
    .string()
    .min(8, "Sua palavra-passe precisa ter ao menos 8 caracteres")
    .max(72)
    .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números"),
  accepted_terms: z.literal(true, {
    errorMap: () => ({ message: "Você precisa aceitar os Termos de Serviço" }),
  }),
});

function mapSignUpError(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("user already")
  ) {
    return "Este e-mail já está cadastrado. Faça login para continuar.";
  }
  if (m.includes("password") || m.includes("weak") || m.includes("6 characters")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  return "Ocorreu um erro ao criar a conta. Verifique os dados e tente novamente.";
}

export const Route = createFileRoute("/checkout")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout — Pratô" },
      { name: "description", content: "Finalize a compra do seu pacote Pratô e acesse a plataforma." },
    ],
  }),
});


function CheckoutPage() {
  const { pacote } = Route.useSearch();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(!!pacote);
  const [submitting, setSubmitting] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const createAccount = useServerFn(createClientAccount);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        toast.info("Você já está logado. Redirecionando para a compra expressa.");
        void navigate({
          to: "/app/comprar",
          replace: true,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!pacote) {
      setLoadingPkg(false);
      return;
    }
    void supabase
      .from("packages")
      .select("*")
      .eq("id", pacote)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        setPkg(data as Package | null);
        setLoadingPkg(false);
      });
  }, [pacote]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pkg) {
      toast.error("Selecione um pacote para continuar.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const raw = {
      company_name: String(formData.get("company_name") ?? ""),
      cnpj: String(formData.get("cnpj") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      accepted_terms: formData.get("accepted_terms") === "on",
    };
    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos do formulário");
      return;
    }
    const cnpjDigits = onlyDigits(parsed.data.cnpj);
    const phoneDigits = onlyDigits(parsed.data.phone);
    setSubmitting(true);
    try {
      // Pre-signup CNPJ check (prevents orphan auth users)
      const { data: cnpjTaken, error: rpcErr } = await supabase.rpc("cnpj_exists", {
        _cnpj: cnpjDigits,
      });
      if (rpcErr) {
        console.error("[checkout] cnpj_exists rpc failed:", rpcErr.message);
        toast.error("Não foi possível validar o CNPJ. Tente novamente.");
        return;
      }
      if (cnpjTaken) {
        toast.error("Este CNPJ já está cadastrado em nossa base.");
        return;
      }

      const result = await createAccount({
        data: {
          package_id: pkg.id,
          full_name: parsed.data.company_name,
          company_name: parsed.data.company_name,
          cnpj: cnpjDigits,
          email: parsed.data.email,
          phone: phoneDigits,
          password: parsed.data.password,
          message: null,
        },
      });

      if (!result.ok) {
        if (result.reason === "email_exists") {
          toast.error("Este e-mail já está cadastrado. Faça login para continuar.");
          return;
        }
        if (result.reason === "cnpj_exists") {
          toast.error("Este CNPJ já está cadastrado em nossa base.");
          return;
        }
        const msg = (result.message ?? "").toLowerCase();
        if (msg.includes("password") || msg.includes("weak") || msg.includes("6 characters")) {
          toast.error("A senha deve ter pelo menos 6 caracteres.");
          return;
        }
        toast.error("Ocorreu um erro ao criar a conta. Tente novamente em instantes.");
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInErr) {
        toast.success("Conta criada! Faça login para continuar.");
      } else {
        toast.success("Conta criada com sucesso!");
      }
      void navigate({
        to: "/pagamento",
        search: result.order_id ? { order: result.order_id } : { pacote: pkg.id },
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado. Tente novamente.");
      return;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
          <button
            onClick={() => navigate({ to: "/" })}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a página inicial
          </button>

          {!pacote || (!loadingPkg && !pkg) ? (
            <div className="rounded-3xl border border-border/70 bg-card p-8 text-center shadow-soft">
              <h1 className="text-2xl font-bold">Selecione um pacote</h1>
              <p className="mt-2 text-muted-foreground text-xs">
                Escolha um dos pacotes disponíveis na nossa página inicial para continuar.
              </p>
              <Button asChild className="mt-6">
                <Link to="/" hash="pacotes">Ver pacotes</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-soft">
                <h1 className="text-3xl font-extrabold tracking-tight">Finalizar compra</h1>
                <p className="mt-2 text-muted-foreground text-xs">
                  Preencha os dados da sua empresa para concluir a compra e acessar a plataforma.
                </p>
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <Field label="Nome da empresa" name="company_name" required />
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <Label htmlFor="cnpj">
                        CNPJ <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="cnpj"
                        name="cnpj"
                        required
                        inputMode="numeric"
                        placeholder="00.000.000/0000-00"
                        value={cnpj}
                        onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                        maxLength={18}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">
                        Telefone / WhatsApp <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        required
                        inputMode="numeric"
                        placeholder="(00) 00000-0000"
                        value={maskPhone(phone)}
                        onChange={(e) => setPhone(onlyDigits(e.target.value))}
                        maxLength={16}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <Field label="E-mail corporativo" name="email" type="email" required autoComplete="email" />
                  <Field
                    label="Criar senha"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                    <Checkbox id="accepted_terms" name="accepted_terms" />
                    <Label htmlFor="accepted_terms" className="text-sm leading-relaxed text-foreground">
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">
                        Termos de Serviço
                      </Link>{" "}
                      e a{" "}
                      <Link to="/privacidade" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">
                        Política de Privacidade
                      </Link>
                      .
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || loadingPkg || onlyDigits(cnpj).length !== 14}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Finalizar compra
                  </Button>
                </form>
              </div>

              <aside className="space-y-4">
                {loadingPkg ? (
                  <div className="h-72 animate-pulse rounded-3xl border border-border/70 bg-card" />
                ) : pkg ? (
                  <div className="rounded-3xl border border-primary/30 bg-card p-6 shadow-soft">
                    {pkg.highlight_tag && (
                      <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        {pkg.highlight_tag}
                      </span>
                    )}
                    <h3 className="mt-3 text-xl font-bold">{pkg.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatNumberBR(pkg.credits_amount)} marmitas</p>
                    <div className="mt-4 text-3xl font-extrabold">{formatBRL(pkg.total_price)}</div>
                    <p className="text-sm text-muted-foreground">{pkg.price_per_meal_text}</p>
                    {!!(pkg.features?.length ? pkg.features : pkg.bonuses)?.length && (
                      <ul className="mt-5 space-y-2 border-t border-border/60 pt-4">
                        {(pkg.features?.length ? pkg.features : pkg.bonuses).map((b, i) => (
                          <li key={i} className="flex gap-2 text-sm text-foreground/80">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-5 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
                      Créditos válidos por 6 meses a partir da compra.
                    </p>
                  </div>
                ) : null}
              </aside>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <div>
      <Label htmlFor={name}>
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="mt-1.5"
      />
    </div>
  );
}
