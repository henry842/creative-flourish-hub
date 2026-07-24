import {
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  Scale,
  Trophy,
  LogOut,
  Sun,
  Moon,
  UserCircle,
  FolderOpen,
  Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { GroqCreditCounter } from "@/components/GroqCreditCounter";
import { LogoMark } from "@/components/Brand";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard },
  { title: "Meus ativos", url: "/assets", icon: FolderOpen },
  { title: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Sentimento", url: "/sentiment", icon: TrendingUp },
  { title: "Comparar", url: "/compare", icon: Scale },
  { title: "Ranking", url: "/ranking", icon: Trophy },
  { title: "Briefing", url: "/briefing", icon: Bell },
  { title: "Perfil", url: "/profile", icon: UserCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sidebar-primary hover:bg-sidebar-accent/60 transition-colors"
          aria-label="FinSight — visão geral"
        >
          <LogoMark
            className="h-7 w-7"
            squareClass="fill-sidebar-primary"
            tickClass="stroke-sidebar-background"
            dotClass="fill-sidebar-ring"
          />
          {!collapsed && <span className="wordmark text-lg text-sidebar-primary">FinSight</span>}
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground rounded-lg h-9"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 gap-1">
        {!collapsed && (
          <div className="px-1 pb-1">
            <GroqCreditCounter />
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={toggleTheme}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span className="ml-2 text-sm">{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>}
        </Button>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2 text-sm">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
