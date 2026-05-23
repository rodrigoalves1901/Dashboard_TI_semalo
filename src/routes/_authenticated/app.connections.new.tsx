import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createConnection, type SystemType } from "@/lib/data";
import { testConnectionOnServer } from "@/lib/connections.functions";
import { ArrowLeft, Database } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/connections/new")({
  component: NewConnectionPage,
});

const SYSTEM_DEFAULTS: Record<SystemType, { port: number; database: string }> = {
  mysql: { port: 3306, database: "mysql" },
  mariadb: { port: 3306, database: "mariadb" },
  sqlserver: { port: 1433, database: "master" },
  sharepoint: { port: 443, database: "" },
  msgraph_licenses: { port: 443, database: "" },
  bigquery: { port: 443, database: "" },
  demo: { port: 0, database: "demo" },
};

const SYSTEM_LABELS: Record<SystemType, string> = {
  demo: "Demo (dados mockados)",
  mysql: "MySQL",
  mariadb: "MariaDB",
  sqlserver: "SQL Server",
  sharepoint: "SharePoint (Microsoft Graph)",
  msgraph_licenses: "Microsoft 365 (Graph API Licenças)",
  bigquery: "Google BigQuery",
};

function NewConnectionPage() {
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    systemType: "demo" as SystemType,
    host: "",
    port: 0,
    database: "demo",
    username: "",
    password: "",
    ssl: false,
  });
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<"ok" | "fail" | null>(null);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const changeSystem = (sys: SystemType) => {
    const d = SYSTEM_DEFAULTS[sys];
    setForm((f) => ({ ...f, systemType: sys, port: d.port, database: f.database || d.database }));
    setTested(null);
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await testConnectionOnServer({
        data: {
          systemType: form.systemType,
          host: form.host,
          port: form.port,
          database: form.database,
          username: form.username,
          password: form.password,
          ssl: form.ssl,
        },
      });
      if (res.ok) {
        setTested("ok");
        toast.success(`Conectado em ${res.latencyMs}ms · ${res.info}`);
      } else {
        setTested("fail");
        toast.error(res.message);
      }
    } catch (err) {
      setTested("fail");
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
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

  const isSharepoint = form.systemType === "sharepoint";
  const isMsGraphLicenses = form.systemType === "msgraph_licenses";
  const isBigQuery = form.systemType === "bigquery";
  const isSqlServer = form.systemType === "sqlserver";
  const isDemo = form.systemType === "demo";

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
            Configure o acesso ao seu sistema (banco de dados ou API).
          </p>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5"
      >
        <Field label="Nome da conexão" hint="Ex: GLPI Produção">
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input"
            placeholder="Minha conexão"
          />
        </Field>

        <Field label="Tipo de sistema">
          <select
            value={form.systemType}
            onChange={(e) => changeSystem(e.target.value as SystemType)}
            className="input"
          >
            {(Object.keys(SYSTEM_LABELS) as SystemType[]).map((s) => (
              <option key={s} value={s}>
                {SYSTEM_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>

        {isDemo ? (
          <div className="rounded-lg border border-dashed border-border-soft bg-surface-muted/40 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Modo Demo:</strong> nenhuma credencial é necessária.
            Esta conexão alimenta os widgets com dados mockados (mesmos presets do GLPI), perfeito
            para construir e validar dashboards enquanto o acesso real ao banco não está liberado.
          </div>
        ) : isBigQuery ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project ID" hint="ID do projeto no Google Cloud (ex: meu-projeto-123)">
                <input
                  required
                  value={form.database}
                  onChange={(e) => update("database", e.target.value)}
                  placeholder="meu-projeto-123"
                  className="input font-mono"
                />
              </Field>
              <Field label="Dataset (opcional)" hint="Nome do dataset padrão para queries">
                <input
                  value={form.host}
                  onChange={(e) => update("host", e.target.value)}
                  placeholder="meu_dataset"
                  className="input font-mono"
                />
              </Field>
            </div>
            <Field
              label="JSON Key (Service Account)"
              hint="Cole aqui o conteúdo completo do arquivo .json da sua Service Account"
            >
              <textarea
                required
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder={'{ "type": "service_account", "project_id": "...", ... }'}
                className="input font-mono"
                style={{ height: 140, resize: "vertical", paddingTop: 10, paddingBottom: 10 }}
              />
            </Field>
            <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Como obter o JSON Key:</strong> No Google Cloud
              Console, acesse <em>IAM &amp; Admin → Service Accounts</em>, crie ou selecione uma
              conta de serviço com permissão{" "}
              <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-foreground">
                BigQuery Data Viewer
              </code>{" "}
              e{" "}
              <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-foreground">
                BigQuery Job User
              </code>
              , depois gere uma nova chave do tipo JSON e cole o conteúdo aqui.
            </div>
          </>
        ) : isSharepoint || isMsGraphLicenses ? (
          <>
            <Field
              label="Tenant ID (Directory ID)"
              hint="Azure AD tenant que possui o app registrado"
            >
              <input
                required
                value={form.host}
                onChange={(e) => update("host", e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="input font-mono"
              />
            </Field>
            {isSharepoint && (
              <Field label="Site URL" hint="Ex: contoso.sharepoint.com:/sites/Marketing">
                <input
                  required
                  value={form.database}
                  onChange={(e) => update("database", e.target.value)}
                  placeholder="contoso.sharepoint.com:/sites/Marketing"
                  className="input font-mono"
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client ID (Application ID)">
                <input
                  required
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  className="input font-mono"
                />
              </Field>
              <Field label="Client Secret">
                <input
                  required
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            {isMsGraphLicenses && (
              <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-4 text-sm text-muted-foreground mt-2">
                <strong className="text-foreground">Dica de Permissão:</strong> O seu aplicativo
                registrado no Microsoft Entra ID (Azure AD) precisa da permissão do tipo aplicação{" "}
                <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-foreground">
                  Organization.Read.All
                </code>{" "}
                ou similar para conseguir ler os SKUs e licenças ativas do tenant.
              </div>
            )}
          </>
        ) : (
          <>
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
              {isSqlServer ? "Criptografar conexão (encrypt)" : "Usar conexão SSL/TLS"}
            </label>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {testing ? "Testando..." : "Testar conexão"}
          </button>
          {tested === "ok" && (
            <span className="text-xs font-semibold text-success">✓ Conexão OK</span>
          )}
          {tested === "fail" && (
            <span className="text-xs font-semibold text-destructive">✗ Falhou</span>
          )}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}
