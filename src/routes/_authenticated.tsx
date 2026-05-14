import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { createOrg, setCurrentOrgId } from "@/lib/data";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const { user, ready, orgs, currentOrg, refreshOrgs } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login", replace: true });
  }, [ready, user, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return null;

  // User authenticated but has no organization yet — onboarding step.
  if (orgs.length === 0 || !currentOrg) {
    return <OnboardingCreateOrg defaultName={`Workspace de ${user.name.split(" ")[0]}`} onCreated={refreshOrgs} />;
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
