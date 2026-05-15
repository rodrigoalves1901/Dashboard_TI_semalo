import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Database, Compass, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Dashboards", icon: LayoutDashboard, exact: true },
  { to: "/app/connections", label: "Conexões", icon: Database },
  { to: "/app/explorer", label: "Explorer", icon: Compass },
  { to: "/app/settings", label: "Config", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                )}
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
