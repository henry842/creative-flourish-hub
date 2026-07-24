import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { LogoMark } from "@/components/Brand";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 sticky top-0 z-20">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="md:hidden flex items-center gap-2 text-foreground">
              <LogoMark className="h-6 w-6" />
              <span className="wordmark text-base">FinSight</span>
            </div>
            <div className="flex-1" />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-6xl p-5 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
