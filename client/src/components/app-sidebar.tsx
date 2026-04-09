import { Link, useLocation } from "wouter";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton 
} from "@/components/ui/sidebar";
import { LayoutDashboard, FolderKanban, Folder, UserCircle, Send, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useClerk } from "@clerk/react";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();
  const { signOut } = useClerk();

  const items = [
    { title: "Browse Hub", url: "/projects", icon: LayoutDashboard },
    { title: "My Projects", url: "/my-projects", icon: Folder },
    { title: "Applicants", url: "/applications", icon: FolderKanban },
    { title: "My Applications", url: "/submissions", icon: Send },
    { title: "Profile", url: "/profile", icon: UserCircle },
  ];

  const handleDisconnect = () => {
    logout(undefined, {
      onSettled: async () => {
        try {
          await signOut({ redirectUrl: "/" });
        } catch {
          setLocation("/");
        }
      },
    });
  };

  return (
    <Sidebar className="border-r-2 border-primary/30 bg-card rounded-none">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-display text-primary text-xl tracking-widest mt-4 mb-6">
            PROJECT SYNC
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} className="font-mono text-base rounded-none transition-all group hover:bg-primary/20 hover:text-primary">
                      <Link href={item.url} className={`flex items-center gap-3 p-3 w-full border-l-4 ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground'}`}>
                        <item.icon className="h-5 w-5 group-hover:animate-pulse" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              <SidebarMenuItem className="mt-8">
                <SidebarMenuButton asChild className="font-mono text-base rounded-none text-destructive hover:bg-destructive/20 hover:text-destructive transition-all">
                  <button onClick={handleDisconnect} className="flex items-center gap-3 p-3 w-full border-l-4 border-transparent">
                    <LogOut className="h-5 w-5" />
                    <span>Disconnect</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
