import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  CalendarCheck,
  ShieldCheck,
  
  Truck,
  Utensils,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import equipePrato from "@/assets/equipe-prato.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatNumberBR } from "@/lib/format";
import type { Package } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Pratô — Seu time mais saudável, sua empresa mais forte" },
      {
        name: "description",
        content:
          "Marmitas premium para empresas. Escolha um pacote, cadastre sua empresa e agende as refeições do seu time em poucos cliques.",
      },
      { property: "og:title", content: "Pratô — Alimentação corporativa" },
      {
        property: "og:description",
        content:
          "Plataforma B2B para gestão de marmitas premium. Pacotes flexíveis, qualidade garantida, sem desperdício.",
      },
    ],
  }),
});

function LandingPage() {
  const [packages, setPackages] = useState<Package[] | null>(null);

  useEffect(() => {
    void supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data }) => setPackages((data ?? []) as Package[]));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Benefits />
        <HowItWorks />
        <AboutUs />
        <Packages packages={packages} />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 h-[360px] w-[360px] rounded-full bg-brand-green/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center md:px-6 md:py-28">
        <div>
          <Badge className="mb-5 bg-primary-soft text-primary hover:bg-primary-soft">
            Alimentação corporativa B2B
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground text-left md:text-4xl md:text-justify">
            Seu time <span className="text-primary">mais saudável,</span>
            <br />
            sua empresa <span className="text-brand-green">mais forte.</span>
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground text-left text-base md:text-justify">
            A Pratô cuida da nutrição do seu time com um cardápio nutritivo, enquanto
            nossa plataforma simplifica toda a gestão: da escolha do pacote ao
            agendamento, você tem o controle total.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <a href="#pacotes">
                Começar agora <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/interesse" search={{ pacote: undefined }}>Fale com a gente</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-green" /> Sem fidelidade</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-green" /> Plataforma de gestão online</span>
            </div>
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-green" /> Entrega no horário</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-brand-green" /> Cardápio feito por nutricionista</span>
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-card">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-primary-soft p-3">
                <Utensils className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Marmitas Premium</p>
                <p className="font-bold text-lg">+ produtividade para seu time</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <Stat value="+7" label="Anos de Mercado" />
              <Stat value="100%" label="Preparo Artesanal" />
              <Stat value="5" label="Cardápios por semana" />
            </div>
            <div className="mt-6 rounded-2xl bg-brand-green-soft p-4 text-sm text-foreground">
              <p className="font-semibold text-brand-green">Mais do que refeições.</p>
              <p className="mt-1 text-muted-foreground">Entregamos resultados para a sua operação corporativa.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground text-center">{label}</div>
    </div>
  );
}

function Benefits() {
  const items = [
    { icon: ClipboardList, title: "Plataforma fácil", text: "Compre pacotes, agende refeições e gerencie sua conta em poucos cliques." },
    { icon: ShieldCheck, title: "Qualidade e Saúde", text: "Cardápio elaborado por nutricionistas, com padrão Pratô em cada entrega." },
    { icon: Truck, title: "Entrega no horário", text: "Logística pensada para empresas: previsibilidade e pontualidade no almoço." },
    { icon: CalendarCheck, title: "Sem desperdício", text: "Agendamento por dia: você só paga pelo que o time realmente vai consumir." },
  ];
  return (
    <section id="beneficios" className="bg-surface py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          eyebrow="Benefícios"
          title="Alimentação corporativa que funciona."
          subtitle="Da gestão simplificada na nossa plataforma à pontualidade na entrega."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col items-center rounded-2xl border border-border/70 bg-secondary p-5 md:p-6 shadow-soft">
              <div className="mb-4 inline-flex rounded-xl bg-primary-soft p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-center">{title}</h3>
              <p className="mt-2 text-xs text-muted-foreground text-center">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function HowItWorks() {
  const steps = [
    { n: "1", title: "Escolha seu plano", text: "Selecione um plano e carregue sua conta com créditos de refeição, na qual 1 crédito equivale a 1 marmita." },
    { n: "2", title: "Cadastre sua empresa", text: "Um cadastro rápido e direto. Garantimos: sem burocracia para você começar." },
    { n: "3", title: "Agende as refeições", text: "Use a nossa plataforma para agendar refeições, programar entregas e acompanhar consumo em tempo real. O pedido mínimo é de 3 marmitas por dia." },
  ];
  return (
    <section id="como-funciona" className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader eyebrow="Como funciona" title="Em três passos simples." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-border/70 p-6 shadow-soft bg-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-green text-lg font-bold text-brand-green-foreground">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground my-[10px] py-[10px] text-justify">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutUs() {
  return (
    <section id="quem-somos" className="bg-surface py-12 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-16 px-4 md:grid-cols-2 md:items-center md:gap-24 md:px-6">
        <div>
          <SectionHeader
            eyebrow="Quem somos"
            title="Mais do que refeições, entregamos resultados."
            align="left"
          />
          <p className="mt-6 text-sm text-muted-foreground text-left md:text-justify">
            A Pratô nasceu para resolver um problema real das empresas: alimentar bem o time
            sem complicação, sem desperdício e com previsibilidade. Nossa equipe combina
            anos de experiência em nutrição, logística e atendimento corporativo para
            entregar uma operação simples, transparente e confiável.
          </p>
          <p className="mt-4 text-sm text-muted-foreground text-left md:text-justify">
            Acreditamos que cuidar de quem faz a sua empresa funcionar é o investimento
            mais inteligente em produtividade e cultura.
          </p>
        </div>
        <div className="relative flex justify-center md:justify-end">
          <img
            src={equipePrato}
            alt="Equipa Pratô"
            loading="lazy"
            className="h-auto w-full rounded-3xl border border-border/70 bg-secondary object-contain shadow-lg"
          />
        </div>
      </div>
    </section>
  );
}

function Packages({ packages }: { packages: Package[] | null }) {
  return (
    <section id="pacotes" className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          eyebrow="Pacotes"
          title="Escolha o pacote ideal para sua empresa."
          subtitle="Mesma marmita premium em todos. A diferença está no volume e nos benefícios para o seu time."
        />

        {packages === null ? (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[480px] animate-pulse rounded-3xl border border-border/70 bg-card" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">
            Nenhum pacote disponível no momento. Volte em breve!
          </p>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {packages.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        )}

        <div className="mx-auto mt-10 max-w-6xl rounded-2xl border border-border/60 bg-secondary/50 p-5 text-center text-sm">
          <p className="font-semibold text-foreground">
            Arroz + Feijão + 2 Proteínas + 2 Acompanhamentos
          </p>
          <p className="mt-1 text-muted-foreground md:whitespace-nowrap">
            Reserva flexível com 1 dia de antecedência | Válido por até 6 meses | Entrega conforme logística do cliente | Cardápio variado diariamente
          </p>
        </div>
      </div>
    </section>
  );
}

function PackageCard({ pkg }: { pkg: Package }) {
  const featured = !!pkg.highlight_tag;
  const isPremium = pkg.highlight_tag?.toUpperCase() === "PREMIUM";
  
  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl border bg-card p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-card ${
        featured
          ? isPremium
            ? "border-brand-green/50 ring-1 ring-brand-green/30"
            : "border-primary/40 ring-1 ring-primary/20"
          : "border-border/70"
      }`}
    >
      {pkg.highlight_tag && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
            isPremium
              ? "bg-brand-green text-brand-green-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {pkg.highlight_tag}
        </span>
      )}
      <h3 className="mt-1 text-sm text-muted-foreground text-center">{pkg.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-center">
        <span
          className={`block font-bold text-5xl ${
            isPremium ? "text-brand-green" : "text-orange-500"
          }`}
        >
          {formatNumberBR(pkg.credits_amount)}
        </span>
        marmitas
      </p>
      <div className="mt-4">
        <div className="font-extrabold text-foreground text-2xl text-center">{formatBRL(pkg.total_price)}</div>
        <div className="mt-1 text-sm text-muted-foreground text-center">{pkg.price_per_meal_text}</div>
      </div>
      {(pkg.features?.length ? pkg.features : pkg.bonuses)?.length ? (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p
            className={`text-xs font-semibold uppercase tracking-wider text-center ${
              isPremium ? "text-brand-green" : "text-primary"
            }`}
          >
            Bônus inclusos
          </p>
          <ul className="mt-3 space-y-2">
            {(pkg.features?.length ? pkg.features : pkg.bonuses).map((b, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/80 text-xs">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ideal para empresas de até 5 colaboradores.
        </p>
      )}
      <div className="mt-auto pt-6">
        <Button
          asChild
          className={`w-full ${
            featured
              ? isPremium
                ? "bg-brand-green text-brand-green-foreground hover:bg-brand-green/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-foreground text-background hover:bg-foreground/90"
          }`}
        >
          <Link to="/checkout" search={{ pacote: pkg.id }}>
            Comprar Pacote
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="bg-brand-green py-12 text-brand-green-foreground md:py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center md:px-6">
        <div className="flex flex-col items-center gap-2">
          <h2 className="mt-2 text-white text-3xl font-bold md:text-4xl">
            Pronto para alimentar melhor seu time?
          </h2>
          <p className="max-w-2xl text-brand-green-foreground/85">
            Conte com a Pratô para cuidar da nutrição corporativa enquanto você foca no
            que sua empresa faz de melhor.
          </p>
        </div>
        <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <a href="#pacotes">Começar agora</a>
        </Button>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const cls = align === "center" ? "text-center mx-auto" : "";
  return (
    <div className={`max-w-3xl ${cls}`}>
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className={`mt-2 text-[26px] font-extrabold tracking-tight text-foreground md:text-2xl ${align === "center" ? "text-center" : "text-left"}`}>{title}</h2>
      {subtitle && <p className="mt-2 text-muted-foreground text-xs">{subtitle}</p>}
    </div>
  );
}
                                                   