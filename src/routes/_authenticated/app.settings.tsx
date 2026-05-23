import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Building2, Sparkles, User as UserIcon, Key } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, currentOrg, orgs, switchOrg } = useAuth();
  const { systemName, rename } = useAppSettings();
  const [draft, setDraft] = useState(systemName);
  const [saving, setSaving] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  // States for password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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

  const onCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    setCreatingOrg(true);
    try {
      const { createOrg } = await import("@/lib/data");
      const org = await createOrg(newOrgName);
      switchOrg(org.id);
      setNewOrgName("");
      toast.success("Organização criada e ativada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreatingOrg(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setChangingPassword(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie sua conta e organização.</p>
      </header>

      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Identidade do sistema</h2>
            <p className="text-xs text-muted-foreground">
              Esse nome aparece em todas as páginas e na aba do navegador. Persiste no banco.
            </p>
          </div>
        </div>
        <form onSubmit={onSave} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[220px]">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nome do sistema
            </span>
            <input
              required
              maxLength={60}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="DigitalDash"
            />
          </label>
          <button
            type="submit"
            disabled={saving || draft.trim() === systemName.trim() || !draft.trim()}
            className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </section>

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
            <Key size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Alterar Senha</h2>
            <p className="text-xs text-muted-foreground">
              Defina uma nova senha forte para proteger sua conta.
            </p>
          </div>
        </div>
        <form onSubmit={onChangePassword} className="mt-5 space-y-4 max-w-md">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nova senha
            </span>
            <input
              required
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Confirmar nova senha
            </span>
            <input
              required
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="Confirme sua nova senha"
            />
          </label>
          <button
            type="submit"
            disabled={changingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {changingPassword ? "Alterando..." : "Alterar Senha"}
          </button>
        </form>
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

      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Criar nova organização</h2>
            <p className="text-xs text-muted-foreground">
              Crie um novo workspace isolado. Você será definido como o proprietário.
            </p>
          </div>
        </div>
        <form onSubmit={onCreateOrg} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[220px]">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Nome da nova organização
            </span>
            <input
              required
              maxLength={120}
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              placeholder="Ex: Minha Empresa"
            />
          </label>
          <button
            type="submit"
            disabled={creatingOrg || !newOrgName.trim()}
            className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {creatingOrg ? "Criando..." : "Criar Organização"}
          </button>
        </form>
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
