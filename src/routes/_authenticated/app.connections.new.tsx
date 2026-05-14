import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createConnection } from "@/lib/data";
import { ArrowLeft, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/connections/new")({
  component: NewConnectionPage,
});

function NewConnectionPage() {
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    systemType: "glpi" as const,
    host: "",
    port: 3306,
    database: "glpi",
    username: "",
    password: "",
    ssl: false,
  });
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<"ok" | "fail" | null>(null);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const test = async () => {
    setTesting(true);
    await new Promise((r) => setTimeout(r, 900));
    const ok = !!form.host && form.port > 0;
    setTested(ok ? "ok" : "fail");
    setTesting(false);
    toast[ok ? "success" : "error"](
      ok ? "Conexão bem-sucedida (simulada)" : "Verifique host e porta",
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    try {
      await createConnection({ orgId: currentOrg.id, ...form });
      toast.success("Conexão salva");
      navigate({ to: "/app/connections" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        to="/app/connections"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Database size={18} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nova conexão</h1>
          <p className="text-sm text-muted-foreground">
            Configure o acesso ao banco de dados do seu sistema.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5">
        <Field label="Nome da conexão" hint="Ex: GLPI Produção">
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input"
            placeholder="GLPI Produção"
          />
        </Field>

        <Field label="Sistema">
          <select
            value={form.systemType}
            onChange={(e) => update("systemType", e.target.value as "glpi")}
            className="input"
          >
            <option value="glpi">GLPI (MySQL/MariaDB)</option>
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Host (IP ou domínio)">
              <input
                required
                value={form.host}
                onChange={(e) => update("host", e.target.value)}
                placeholder="192.168.1.50"
                className="input font-mono"
              />
            </Field>
          </div>
          <Field label="Porta">
            <input
              required
              type="number"
              value={form.port}
              onChange={(e) => update("port", Number(e.target.value))}
              className="input font-mono"
            />
          </Field>
        </div>

        <Field label="Nome do banco">
          <input
            required
            value={form.database}
            onChange={(e) => update("database", e.target.value)}
            className="input font-mono"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usuário">
            <input
              required
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Senha">
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ssl}
            onChange={(e) => update("ssl", e.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary)]"
          />
          Usar conexão SSL/TLS
        </label>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {testing ? "Testando..." : "Testar conexão"}
          </button>
          {tested === "ok" && <span className="text-xs font-semibold text-success">✓ Conexão OK</span>}
          {tested === "fail" && <span className="text-xs font-semibold text-destructive">✗ Falhou</span>}
          <div className="flex-1" />
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar conexão"}
          </button>
        </div>
      </form>

      <style>{`.input{height:40px;width:100%;border-radius:8px;border:1px solid var(--border);background:var(--card);padding:0 12px;font-size:14px;color:var(--foreground);}.input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px color-mix(in oklch, var(--primary) 12%, transparent);}`}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}
