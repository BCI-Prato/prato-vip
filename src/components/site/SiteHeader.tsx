import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  function scrollToPacotes(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const el = document.getElementById("pacotes");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-14 w-auto" />
          <span className="sr-only">Pratô</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <a href="#beneficios" className="hover:text-foreground">Benefícios</a>
          <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
          <a href="#quem-somos" className="hover:text-foreground">Quem somos</a>
          <a href="#pacotes" className="hover:text-foreground">Pacotes</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden md:inline-flex rounded-full bg-primary-soft text-primary hover:bg-primary-soft/80">
            <Link to="/login">Já sou cliente</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
            <a href="#pacotes" onClick={scrollToPacotes}>Ver pacotes</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
