import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Database,
  Settings,
  LogOut,
  Search,
  Bell,
  Plus,
  Building2,
  ChevronDown,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/app", label: "Dashboards", icon: LayoutDashboard, exact: true },
  { to: "/app/connections", label: "Conexões", icon: Database },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, currentOrg, orgs, signOut, switchOrg } = useAuth();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Compact sidebar */}
      <aside className="hidden md:flex w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-sidebar py-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
          F
        </div>
        <div className="mt-4 flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-lg transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon size={18} strokeWidth={2} />
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main sidebar */}
      <aside className="hidden lg:flex w-[200px] shrink-0 flex-col border-r border-border bg-sidebar p-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-secondary">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-foreground">
              <Building2 size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[12px] font-bold text-foreground">
                {currentOrg?.name ?? "Organização"}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">Workspace</div>
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Trocar organização</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => switchOrg(o.id)}>
                {o.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mt-6 mb-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Geral
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                  active
                    ? "bg-accent font-semibold text-accent-foreground"
                    : "font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
              {user?.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-foreground">{user?.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{user?.email}</div>
            </div>
            <button
              onClick={signOut}
              aria-label="Sair"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-6 backdrop-blur">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar dashboards, conexões..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <ThemeToggle />
          <button
            aria-label="Notificações"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <Bell size={16} />
          </button>
          <Link
            to="/app/connections/new"
            className="hidden sm:inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={14} /> Nova conexão
          </Link>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
