import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, UtensilsCrossed, Factory, Users, LifeBuoy, LogOut, Loader2, CreditCard, Package, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Painel administrativo — Pratô" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-soft">
          <h1 className="mt-1 text-muted-foreground text-center text-lg">Acesso negado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é restrita a administradores Pratô. Sua conta está autenticada,
            mas não possui as permissões necessárias.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => void signOut()} variant="outline">Sair desta conta</Button>
            <Button asChild>
              <Link to="/">Ir para o site</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ to: "/admin" | "/admin/cardapio" | "/admin/pacotes" | "/admin/producao" | "/admin/pagamentos" | "/admin/clientes" | "/admin/suporte" | "/admin/documentos"; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/cardapio", label: "Cardápio", icon: UtensilsCrossed },
    { to: "/admin/pacotes", label: "Pacotes", icon: Package },
    { to: "/admin/producao", label: "Produção", icon: Factory },
    { to: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
    { to: "/admin/clientes", label: "Clientes", icon: Users },
    { to: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
    { to: "/admin/documentos", label: "Documentos", icon: FileText },
  ];

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card md:block">
        <div className="flex h-16 items-center border-b border-border/70 px-6">
          <Logo className="h-8 w-auto" />
          <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/70 bg-card px-4 md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <Logo className="h-7 w-auto" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</span>
          </div>
          <nav className="flex gap-1 md:hidden">
            {navItems.map(({ to, label }) => (
              <Link key={to} to={to} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">{user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void signOut().then(() => navigate({ to: "/login" }))}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
