import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Building2, Sparkles, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, currentOrg, orgs } = useAuth();
  const { systemName, rename } = useAppSettings();
  const [draft, setDraft] = useState(systemName);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(systemName), [systemName]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await rename(draft);
      toast.success("Nome do sistema atualizado");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie sua conta e organização.
        </p>
      </header>

      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <UserIcon size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Perfil</h2>
            <p className="text-xs text-muted-foreground">Suas informações pessoais</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Row label="Nome" value={user?.name} />
          <Row label="Email" value={user?.email} />
        </dl>
      </section>

      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Organização atual</h2>
            <p className="text-xs text-muted-foreground">{orgs.length} organizações no total</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Row label="Nome" value={currentOrg?.name} />
          <Row label="ID" value={currentOrg?.id} mono />
        </dl>
      </section>

      <section className="rounded-[14px] border border-dashed border-border-soft p-6 text-sm text-muted-foreground">
        <strong className="text-foreground">Conectado ao Supabase.</strong> Seus dados de usuário,
        organização, conexões, dashboards e widgets agora persistem no banco e ficam acessíveis em
        qualquer dispositivo.
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 font-mono text-sm" : "mt-1 text-sm font-semibold"}>
        {value || "—"}
      </dd>
    </div>
  );
}
