import { useState } from "react";
import { MousePointerClick, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DrilldownConfig } from "@/lib/drilldown";
import type { Connection, Dashboard } from "@/lib/data";

type Props = {
  config: DrilldownConfig;
  defaultConnectionId: string | null;
  connections: Connection[];
  dashboards: Dashboard[];
  onChange: (config: DrilldownConfig) => void;
};

type Mode = "off" | "table" | "dashboard";

export function WidgetDrilldownDialog({ config, defaultConnectionId, connections, dashboards, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const initial: Mode = config?.type === "table" ? "table" : config?.type === "dashboard" ? "dashboard" : "off";
  const [mode, setMode] = useState<Mode>(initial);
  const [title, setTitle] = useState<string>(config?.type === "table" ? config.title ?? "" : "");
  const [connectionId, setConnectionId] = useState<string>(
    (config?.type === "table" ? config.connectionId : null) ?? defaultConnectionId ?? "",
  );
  const [sql, setSql] = useState<string>(config?.type === "table" ? config.sql ?? "" : "");
  const [dashboardId, setDashboardId] = useState<string>(config?.type === "dashboard" ? config.dashboardId : "");

  const has = !!config;

  const save = () => {
    if (mode === "off") onChange(null);
    else if (mode === "table") {
      onChange({
        type: "table",
        title: title.trim() || null,
        connectionId: connectionId || null,
        sql: sql.trim() || null,
      });
    } else if (mode === "dashboard") {
      if (!dashboardId) return;
      onChange({ type: "dashboard", dashboardId });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={has ? "Editar ação de clique" : "Configurar ação de clique"}
          aria-label="Configurar ação de clique"
          className={
            has
              ? "grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary shadow-sm hover:bg-primary/25"
              : "grid h-6 w-6 place-items-center rounded-md bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground"
          }
        >
          {has ? <Search size={13} /> : <MousePointerClick size={13} />}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ação ao clicar no widget</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {(["off", "table", "dashboard"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  mode === m
                    ? "rounded-md border-2 border-primary bg-primary/10 px-3 py-2 text-xs font-semibold"
                    : "rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                }
              >
                {m === "off" ? "Desativado" : m === "table" ? "Abrir planilha" : "Outro dashboard"}
              </button>
            ))}
          </div>

          {mode === "table" && (
            <div className="space-y-3">
              <Field label="Título da planilha (opcional)">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Licenças ativas"
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                />
              </Field>
              <Field label="Conexão">
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
                >
                  <option value="">— Mesma do widget / mock —</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="SQL de detalhe (somente SELECT)">
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder="SELECT id, name, email, expires_at FROM licenses WHERE active = 1"
                  rows={5}
                  className="w-full rounded-md border border-border bg-card p-2 font-mono text-xs"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Enquanto o backend de execução real não estiver plugado, a planilha mostra dados de exemplo
                  derivados do widget.
                </p>
              </Field>
            </div>
          )}

          {mode === "dashboard" && (
            <Field label="Dashboard de destino">
              <select
                value={dashboardId}
                onChange={(e) => setDashboardId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
              >
                <option value="">— Selecione —</option>
                {dashboards.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
          >
            Remover
          </button>
          <button
            type="button"
            onClick={save}
            disabled={mode === "dashboard" && !dashboardId}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
