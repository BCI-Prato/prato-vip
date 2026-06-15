import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { verifyExistingUser } from "@/lib/auth.functions";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Acesse sua conta — Pratô" },
      { name: "description", content: "Entre na plataforma de gestão Pratô." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const NOT_FOUND_MSG =
  "E-mail não encontrado. Se ainda não é cliente, volte à página inicial e escolha um dos nossos pacotes para começar.";

function isAdminEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith("@pratoservicos.com");
}

const OAUTH_FLAG = "oauth_in_progress";

function LoginPage() {
  const { signIn, session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const verifyFn = useServerFn(verifyExistingUser);
  const [loading, setLoading] = useState(false);
  // Inicia true se voltamos de um OAuth em andamento, para overlay imediato.
  // Só considera "voltando do OAuth" se a URL tiver os parâmetros do callback
  // (code/state) E houver flag em sessionStorage. Caso contrário, evita o
  // overlay travado após logout ou ao abrir /login normalmente.
  const isOAuthReturn = () => {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem(OAUTH_FLAG) !== "google") return false;
    const search = window.location.search;
    return search.includes("code=") || window.location.hash.includes("access_token");
  };
  const [googleLoading, setGoogleLoading] = useState(isOAuthReturn);
  const [oauthChecking, setOauthChecking] = useState(isOAuthReturn);

  // Saneamento: se não estamos retornando de OAuth, garante que a flag
  // não fique presa de uma sessão anterior.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOAuthReturn()) {
      sessionStorage.removeItem(OAUTH_FLAG);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Failsafe: se o overlay ficou ativo mas nenhuma sessão chegou em 6s,
  // libera a tela para o usuário tentar de novo.
  useEffect(() => {
    if (!oauthChecking) return;
    const t = setTimeout(() => {
      if (!session?.user) {
        sessionStorage.removeItem(OAUTH_FLAG);
        setOauthChecking(false);
        setGoogleLoading(false);
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [oauthChecking, session?.user]);

  // Após retorno do OAuth do Google, valida se o usuário já existia.
  useEffect(() => {
    if (!session?.user) return;
    const provider = session.user.app_metadata?.provider;
    if (provider !== "google") return;
    // Sentinel para rodar a verificação apenas uma vez por sessão.
    const flagKey = `oauth_verified_${session.user.id}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
    sessionStorage.removeItem(OAUTH_FLAG);

    const email = session.user.email ?? null;

    // Fast-path: admins do domínio @pratoservicos.com não passam pela
    // server function (evita cold start). O domínio + role já são
    // validados server-side por triggers no banco.
    if (isAdminEmail(email)) {
      redirectByRole(email);
      return;
    }

    setOauthChecking(true);
    void verifyFn()
      .then(async (res) => {
        if (!res.allowed) {
          await supabase.auth.signOut();
          toast.error(NOT_FOUND_MSG);
          setOauthChecking(false);
          setGoogleLoading(false);
          return;
        }
        redirectByRole(res.email ?? email);
      })
      .catch(async () => {
        await supabase.auth.signOut();
        toast.error("Não foi possível concluir o login.");
        setOauthChecking(false);
        setGoogleLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Login email/senha já autenticado (sem OAuth) → roteia direto.
  useEffect(() => {
    if (!user) return;
    const provider = user.app_metadata?.provider;
    if (provider === "google") return; // tratado acima
    redirectByRole(user.email ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function redirectByRole(email: string | null) {
    if (isAdminEmail(email)) {
      void navigate({ to: "/admin" });
    } else {
      void navigate({ to: "/app" });
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      const msg = error.toLowerCase();
      if (msg.includes("invalid login credentials")) {
        toast.error("E-mail ou senha incorretos. Use 'Esqueci minha senha' se precisar redefinir.");
      } else if (msg.includes("email not confirmed")) {
        toast.error("Confirme seu e-mail antes de entrar.");
      } else {
        toast.error("Não foi possível entrar. Tente novamente.");
      }
      return;
    }
    redirectByRole(email);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    sessionStorage.setItem(OAUTH_FLAG, "google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/login",
      },
    });
    if (error) {
      sessionStorage.removeItem(OAUTH_FLAG);
      setGoogleLoading(false);
      toast.error("Não foi possível entrar com o Google.");
    }
    // se sem erro: o navegador redireciona para o Google; ao voltar, useEffect valida.
  }

  async function handleForgot() {
    const email = window.prompt("Informe o e-mail cadastrado para receber o link de redefinição:");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }
    toast.success("Se o e-mail estiver cadastrado, enviamos um link de redefinição.");
  }

  if (oauthChecking || authLoading || user) {
    const message = oauthChecking
      ? "Conectando ao Google…"
      : user
        ? "Redirecionando…"
        : "Carregando…";
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <Logo className="h-9 w-auto" />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar ao site
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground text-center">
          Acesse sua conta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Bem-vindo à plataforma de gestão da Pratô.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="mt-1.5" />
            <button
              type="button"
              onClick={handleForgot}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
            >
              Esqueci minha senha
            </button>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          ou
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={googleLoading}
          onClick={() => void handleGoogle()}
          className="w-full rounded-full"
        >
          {googleLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-4 w-4" />
          )}
          {googleLoading ? "Conectando ao Google…" : "Entrar com o Google"}
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ainda não é cliente?{" "}
          <Link to="/" hash="pacotes" className="font-medium text-primary hover:underline">
            Conheça nossos pacotes →
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.89-1.74 2.982-4.305 2.982-7.351z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.598-4.122H3.064v2.59A9.996 9.996 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.402 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.064a9.996 9.996 0 0 0 0 8.98l3.338-2.59z" />
      <path fill="#EA4335" d="M12 5.977c1.468 0 2.786.505 3.823 1.495l2.868-2.868C16.96 2.99 14.696 2 12 2A9.996 9.996 0 0 0 3.064 7.51L6.402 10.1C7.19 7.737 9.395 5.977 12 5.977z" />
    </svg>
  );