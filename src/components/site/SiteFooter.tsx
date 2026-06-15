import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
        <div className="space-y-3">
          <Logo className="h-10 w-auto" />
          <p className="text-sm text-muted-foreground">
            Alimentação corporativa que cuida da nutrição do seu time
            e da produtividade da sua empresa.
          </p>
        </div>
        <div className="text-sm md:justify-self-center">
          <h4 className="mb-3 font-semibold">Empresa</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li><a href="#quem-somos" className="hover:text-foreground">Quem somos</a></li>
            <li><a href="#pacotes" className="hover:text-foreground">Pacotes</a></li>
            <li><Link to="/termos" className="hover:text-foreground">Termos de Serviço</Link></li>
            <li><Link to="/privacidade" className="hover:text-foreground">Privacidade</Link></li>
          </ul>
        </div>
        <div className="text-sm md:justify-self-end">
          <h4 className="mb-3 font-semibold">Contato</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>comercial@pratoservicos.com</li>
            <li>Atendimento comercial: seg–sex, 8h–17h</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pratô Serviços de Alimentação · CNPJ 30.433.877/0001-37
      </div>
    </footer>
  );
}
