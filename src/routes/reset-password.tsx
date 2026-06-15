import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Pratô" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "ready" | "invalid">("validating");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) setStatus("ready");
    };

    // Listener cobre o caso normal (cliente detecta sozinho).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") markReady();
    });

    (async () => {
      try {
        const url = new URL(window.location.href);

        // 0) Link com erro do Supabase (expirado/inválido).
        const errParam =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error") ||
          (window.location.hash.includes("error") ? decodeURIComponent(window.location.hash) : null);
        if (errParam) {
          if (!cancelled) setStatus("invalid");
          return;
        }

        // 1) Fluxo PKCE: ?code=... na query string.
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.pathname + url.search + url.hash);
            markReady();
            return;
          }
        }

        // 2) Fluxo implicit: tokens no hash. Aguarda o cliente processar.
        if (window.location.hash.includes("access_token")) {
          for (let i = 0; i < 20; i++) {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              markReady();
              return;
            }
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        // 3) Sessão já ativa (ex: reentrada na página).
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          markReady();
          return;
        }

        // Timeout maior: 8s.
        setTimeout(async () => {
          if (cancelled) return;
          const { data: final } = await supabase.auth.getSession();
          if (final.session) {
            markReady();
          } else {
            setStatus("invalid");
          }
        }, 8000);
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir a senha. O link pode ter expirado.");
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    void navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center justify-between">
          <Logo className="h-9 w-auto" />
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar ao login
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground text-center">
          Definir nova senha
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Escolha uma senha forte com pelo menos 8 caracteres.
        </p>
        {status === "validating" ? (
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando link…
          </div>
        ) : status === "invalid" ? (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Link inválido ou expirado. Solicite um novo e-mail de redefinição na tela de login.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input id="confirm" name="confirm" type="password" required className="mt-1.5" />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
