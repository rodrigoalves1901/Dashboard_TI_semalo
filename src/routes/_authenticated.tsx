import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { createOrg, setCurrentOrgId } from "@/lib/data";
import { type MenuKey } from "@/lib/rbac";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, ready: authReady, orgs, currentOrg, refreshOrgs } = useAuth();
  const { ready: permReady, isSuperAdmin, can } = usePermissions();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullscreenRoute = /^\/app\/(tv\/[^/]+|slideshow\/[^/]+\/play)$/.test(pathname);

  useEffect(() => {
    if (authReady && !user) navigate({ to: "/login", replace: true });
  }, [authReady, user, navigate]);

  // Central Route Authorization Gate
  useEffect(() => {
    if (!user || !currentOrg || !permReady) return;

    // 1. Admin routes require super-admin
    const isAdminRoute = pathname.startsWith("/app/admin");
    if (isAdminRoute && !isSuperAdmin) {
      navigate({ to: "/app", replace: true });
      return;
    }

    // 2. Module routes require view permission
    const routeToMenuMap: { prefix: string; menu: MenuKey }[] = [
      { prefix: "/app/tv", menu: "tv" },
      { prefix: "/app/slideshow", menu: "slideshow" },
      { prefix: "/app/connections", menu: "connections" },
      { prefix: "/app/explorer", menu: "explorer" },
      { prefix: "/app/settings", menu: "settings" },
      { prefix: "/app/ia", menu: "ia" },
    ];

    for (const mapping of routeToMenuMap) {
      if (pathname.startsWith(mapping.prefix)) {
        if (!can(mapping.menu, "view")) {
          navigate({ to: "/app", replace: true });
          return;
        }
      }
    }

    // 3. Dashboards view check on main dashboard route
    if (pathname === "/app" || pathname === "/app/" || pathname.startsWith("/app/dashboards")) {
      if (!can("dashboards", "view")) {
        const allowedMenus: { menu: MenuKey; path: string }[] = [
          { menu: "tv", path: "/app/tv" },
          { menu: "slideshow", path: "/app/slideshow" },
          { menu: "connections", path: "/app/connections" },
          { menu: "explorer", path: "/app/explorer" },
          { menu: "settings", path: "/app/settings" },
        ];
        const nextAllowed = allowedMenus.find((m) => can(m.menu, "view"));
        if (nextAllowed) {
          navigate({ to: nextAllowed.path, replace: true });
        }
      }
    }
  }, [pathname, user, currentOrg, permReady, isSuperAdmin, can, navigate]);

  if (!authReady || (user && currentOrg && !permReady)) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return null;

  // User authenticated but has no organization yet — onboarding step.
  if (orgs.length === 0 || !currentOrg) {
    return (
      <OnboardingCreateOrg
        defaultName={`Workspace de ${user.name.split(" ")[0]}`}
        onCreated={refreshOrgs}
      />
    );
  }

  if (isFullscreenRoute) {
    return <Outlet />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function OnboardingCreateOrg({
  defaultName,
  onCreated,
}: {
  defaultName: string;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const org = await createOrg(name.trim());
      setCurrentOrgId(org.id);
      await onCreated();
      toast.success("Organização criada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-[14px] border border-border bg-card p-8 shadow-card">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Building2 size={18} />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">Crie sua organização</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Você ainda não tem uma organização. Dê um nome ao seu workspace para começar.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome</span>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar organização"}
          </button>
        </form>
      </div>
    </div>
  );
}
