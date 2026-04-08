import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Redirect } from "wouter";

function DashboardHint({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { toggleSidebar } = useSidebar();

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        toggleSidebar();
        onDismiss();
      }}
      className="ml-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary animate-pulse"
    >
      <ArrowLeft className="h-4 w-4" />
      Click here for Dashboard
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isClerkLoaded } = useAuth();
  const isMobile = useIsMobile();
  const [showDashboardHint, setShowDashboardHint] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const dismissDashboardHint = () => {
    if (!isMobile || !showDashboardHint) {
      return;
    }
    setShowDashboardHint(false);
  };

  if (!isClerkLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Terminal className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/auth" />;
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background font-mono">
        <AppSidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <header className="flex items-center p-4 border-b-2 border-primary/20 bg-card/50 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger
              className="text-primary hover:bg-primary/20 hover:text-primary transition-colors p-2"
              onClick={dismissDashboardHint}
            />
            <DashboardHint visible={isMobile && showDashboardHint} onDismiss={dismissDashboardHint} />
            <div className="ml-4 font-display text-muted-foreground tracking-widest">
              STATUS: <span className="text-primary animate-pulse">ONLINE</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
