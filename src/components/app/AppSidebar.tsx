import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  CalendarDays,
  Users,
  Coins,
  Clock,
  LifeBuoy,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/site/Logo";

const items: Array<{
  title: string;
  url: "/app" | "/app/agendamentos" | "/app/equipe" | "/app/creditos" | "/app/historico" | "/app/suporte" | "/app/configuracoes";
  icon: typeof Home;
  exact?: boolean;
}> = [
  { title: "Visão Geral", url: "/app", icon: Home, exact: true },
  { title: "Agendamentos", url: "/app/agendamentos", icon: CalendarDays },
  { title: "Minha Equipe", url: "/app/equipe", icon: Users },
  { title: "Meus Créditos", url: "/app/creditos", icon: Coins },
  { title: "Histórico", url: "/app/historico", icon: Clock },
  { title: "Suporte", url: "/app/suporte", icon: LifeBuoy },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });


  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
          <Logo className="h-9 w-auto" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url, item.exact)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
