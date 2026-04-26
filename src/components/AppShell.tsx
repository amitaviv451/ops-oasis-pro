import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, UserPlus, Briefcase, CalendarRange, Users, FileText, Receipt,
  UsersRound, BookOpen, Package, MessageSquare, BarChart3, MapPin, Settings, Zap,
  ChevronLeft, ChevronRight, LogOut, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: UserPlus },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/dispatch", label: "Dispatch", icon: CalendarRange },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/estimates", label: "Estimates", icon: FileText },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/price-book", label: "Price Book", icon: BookOpen },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/service-areas", label: "Service Areas", icon: MapPin },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full bg-secondary/40">
      <aside className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold tracking-tight text-sidebar-accent-foreground">FieldPro</span>
            </div>
          )}
          {collapsed && (
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary mx-auto">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2 space-y-1">
          {role === "TECHNICIAN" && (
            <button
              onClick={() => navigate("/field")}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? "Field view" : undefined}
            >
              <Smartphone className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Switch to field view</span>}
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent/60"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
          <div />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user?.email}</div>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
