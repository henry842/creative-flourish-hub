import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Shield } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/50 px-4 glass sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
          <footer className="h-8 flex items-center justify-end px-4 border-t border-border/30 text-xs text-muted-foreground gap-1.5">
            <Shield className="h-3 w-3 text-accent" />
            <span>Conexão segura</span>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
