import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL } from "@/lib/format";
import type { Package } from "@/lib/types";

const searchSchema = z.object({
  pacote: z.string().uuid().optional(),
});

const leadSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome completo").max(120),
  company_name: z.string().trim().min(2, "Informe o nome da empresa").max(160),
  email: z.string().trim().email("E-mail inválido").max(254),
  phone: z.string().trim().min(8, "Telefone inválido").max(30),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  accepted_terms: z.literal(true, {
    errorMap: () => ({ message: "Você precisa aceitar os Termos de Serviço" }),
  }),
});

export const Route = createFileRoute("/interesse")({
  validateSearch: (s) => searchSchema.parse(s),
  component: InterestPage,
  head: () => ({
    meta: [
      { title: "Fale com a gente — Pratô" },
      {
        name: "description",
        content:
          "Preencha seus dados e nossa equipe entrará em contato em breve para apresentar a Pratô.",
      },
    ],
  }),
});

function InterestPage() {
  const { pacote } = Route.useSearch();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(!!pacote);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pacote) return;
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
    const form = e.currentTarget;
    const formData = new FormData(form);
    const raw = {
      full_name: String(formData.get("full_name") ?? ""),
      company_name: String(formData.get("company_name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      message: String(formData.get("message") ?? ""),
      accepted_terms: formData.get("accepted_terms") === "on",
    };
    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os campos do formulário");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        full_name: parsed.data.full_name,
        company_name: parsed.data.company_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        message: parsed.data.message ? parsed.data.message : null,
        package_id: pacote ?? null,
        accepted_terms_at: new Date().toISOString(),
        status: "novo",
      });
      if (error) {
        console.error(error);
        toast.error("Não foi possível enviar agora. Tente novamente.");
        return;
      }
      toast.success("Mensagem enviada! Entraremos em contato em breve.");
      form.reset();
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

          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-soft">
                <h1 className="text-3xl font-extrabold tracking-tight">Fale com a gente</h1>
                <p className="mt-2 text-muted-foreground text-sm">
                  Preencha seus dados e nossa equipe entrará em contato em breve.
                </p>
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <Field label="Seu nome" name="full_name" required />
                  <Field label="Empresa" name="company_name" required />
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="E-mail corporativo" name="email" type="email" required />
                    <Field label="Telefone / WhatsApp" name="phone" required />
                  </div>
                  <div>
                    <Label htmlFor="message">Mensagem (opcional)</Label>
                    <Textarea
                      id="message"
                      name="message"
                      rows={4}
                      placeholder="Conte um pouco sobre o tamanho do time, frequência desejada, etc."
                      maxLength={2000}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                    <Checkbox id="accepted_terms" name="accepted_terms" />
                    <Label htmlFor="accepted_terms" className="text-sm leading-relaxed text-foreground">
                      Li e aceito os{" "}
                      <a
                        href="/termos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        Termos de Serviço
                      </a>{" "}
                      e a{" "}
                      <a
                        href="/privacidade"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        Política de Privacidade
                      </a>
                      .
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Enviar Mensagem
                  </Button>
                </form>
              </div>

              <aside className="space-y-4">
                {loadingPkg ? (
                  <div className="h-64 animate-pulse rounded-3xl border border-border/70 bg-card" />
                ) : pkg ? (
                  <div className="rounded-3xl border border-primary/30 bg-card p-6 shadow-soft">
                    {pkg.highlight_tag && (
                      <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        {pkg.highlight_tag}
                      </span>
                    )}
                    <h3 className="mt-3 text-2xl font-bold">Pacote {pkg.name}</h3>
                    <p className="text-sm text-muted-foreground">{pkg.credits_amount} refeições</p>
                    <div className="mt-4 text-3xl font-extrabold">{formatBRL(pkg.total_price)}</div>
                    <p className="text-sm text-muted-foreground">{pkg.price_per_meal_text}</p>
                    <p className="mt-4 text-sm text-foreground/80">{pkg.advantage_description}</p>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft">
                    <h3 className="text-lg font-semibold">Não escolheu um pacote ainda?</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sem problemas. Conte sobre sua empresa e ajudamos você a encontrar o melhor formato.
                    </p>
                    <Button asChild variant="outline" className="mt-4 w-full">
                      <Link to="/" hash="pacotes">Ver pacotes</Link>
                    </Button>
                  </div>
                )}
                <ul className="space-y-2 rounded-3xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-soft">
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-green" /> Resposta em até 1 dia útil</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-green" /> Atendimento humano e consultivo</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-brand-green" /> Sem compromisso</li>
                </ul>
              </aside>
            </div>
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
