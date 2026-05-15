import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Database,
  Compass,
  Settings,
  Tv,
  PlayCircle,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primary = [
  { to: "/app", label: "Dashboards", icon: LayoutDashboard, exact: true },
  { to: "/app/connections", label: "Conexões", icon: Database },
  { to: "/app/tv", label: "Modo TV", icon: Tv },
];

const more = [
  { to: "/app", label: "Dashboards", icon: LayoutDashboard, exact: true },
  { to: "/app/connections", label: "Conexões", icon: Database },
  { to: "/app/tv", label: "Modo TV", icon: Tv },
  { to: "/app/slideshow", label: "Slideshow", icon: PlayCircle },
  { to: "/app/explorer", label: "Explorer", icon: Compass },
  { to: "/app/settings", label: "Configurações", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {primary.map((item) => {
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
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Mais"
                className="relative flex w-full flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal size={20} />
                <span>Mais</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 grid grid-cols-3 gap-3 pb-6">
                {more.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to, item.exact);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center text-xs font-semibold transition-colors",
                          active
                            ? "border-primary text-primary"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                      >
                        <Icon size={22} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
