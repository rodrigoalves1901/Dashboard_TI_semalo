import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  db,
  subscribe,
  uid,
  type Connection,
  type Dashboard,
  type Widget,
  type ChartType,
} from "@/lib/storage";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PRESETS, getPreset, type PresetId } from "@/lib/glpi-presets";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/dashboards/$id/edit")({
  component: DashboardEditor,
});

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "metric", label: "Métrica" },
  { value: "bar", label: "Barras" },
  { value: "line", label: "Linha" },
  { value: "donut", label: "Donut" },
];

function DashboardEditor() {
  const { id } = Route.useParams();
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [conns, setConns] = useState<Connection[]>([]);

  // Builder form state
  const [title, setTitle] = useState("");
  const [presetId, setPresetId] = useState<PresetId>("tickets_open");
  const [chartType, setChartType] = useState<ChartType>("metric");
  const [connectionId, setConnectionId] = useState<string>("");

  useEffect(() => {
    const refresh = () => {
      const d = db.listDashboards().find((x) => x.id === id) ?? null;
      setDashboard(d);
      setWidgets(db.listWidgets().filter((w) => w.dashboardId === id));
      if (currentOrg) {
        setConns(db.listConnections().filter((c) => c.orgId === currentOrg.id));
      }
    };
    refresh();
    return subscribe(refresh);
  }, [id, currentOrg]);

  // When preset changes, default chart type
  useEffect(() => {
    const p = getPreset(presetId);
    if (p) {
      setChartType(p.defaultChart);
      if (!title) setTitle(p.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  if (!dashboard) {
    return (
      <div className="space-y-3">
        <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Voltar
        </Link>
        <p className="text-sm text-muted-foreground">Dashboard não encontrado.</p>
      </div>
    );
  }

  const addWidget = () => {
    if (!title.trim()) return toast.error("Defina um título");
    const w: Widget = {
      id: uid(),
      dashboardId: dashboard.id,
      connectionId: connectionId || null,
      title: title.trim(),
      chartType,
      preset: presetId,
      refreshInterval: 60,
    };
    db.saveWidgets([...db.listWidgets(), w]);
    toast.success("Widget adicionado");
    setTitle("");
  };

  const removeWidget = (wid: string) => {
    db.saveWidgets(db.listWidgets().filter((w) => w.id !== wid));
  };

  const renameDashboard = () => {
    const name = window.prompt("Nome do dashboard", dashboard.name);
    if (!name) return;
    const updated = { ...dashboard, name };
    db.saveDashboards(db.listDashboards().map((d) => (d.id === dashboard.id ? updated : d)));
  };

  return (
    <div className="space-y-6">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Dashboards
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button onClick={renameDashboard} className="text-2xl font-bold tracking-tight hover:underline">
            {dashboard.name}
          </button>
          <p className="mt-1 text-sm text-muted-foreground">Editor — adicione widgets ao dashboard.</p>
        </div>
        <button
          onClick={() => navigate({ to: "/app/dashboards/$id", params: { id: dashboard.id } })}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Concluir
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Builder */}
        <aside className="rounded-[14px] border border-border bg-card p-5 shadow-card space-y-4 h-fit lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-primary" />
            <h3 className="text-[15px] font-bold">Novo widget</h3>
          </div>

          <Field label="Conexão">
            <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="input">
              <option value="">— Sem conexão (dados de exemplo) —</option>
              {conns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.systemType})
                </option>
              ))}
            </select>
            {conns.length === 0 && (
              <Link to="/app/connections/new" className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">
                + Adicionar conexão
              </Link>
            )}
          </Field>

          <Field label="Métrica / Consulta">
            <select value={presetId} onChange={(e) => setPresetId(e.target.value as PresetId)} className="input">
              {(["Tickets", "SLA", "Operação"] as const).map((cat) => (
                <optgroup key={cat} label={cat}>
                  {PRESETS.filter((p) => p.category === cat).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {getPreset(presetId)?.description}
            </span>
          </Field>

          <Field label="Tipo de gráfico">
            <div className="grid grid-cols-2 gap-2">
              {CHART_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChartType(opt.value)}
                  className={
                    chartType === opt.value
                      ? "h-9 rounded-md bg-accent text-xs font-semibold text-accent-foreground"
                      : "h-9 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-secondary"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Título do widget">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          </Field>

          <div className="rounded-lg border border-dashed border-border-soft p-3">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pré-visualização
            </span>
            <div className="mt-2">
              <WidgetRenderer
                title={title || "Widget"}
                presetId={presetId}
                chartType={chartType}
                suffix={presetId === "sla_compliance" ? "%" : undefined}
              />
            </div>
          </div>

          <button
            onClick={addWidget}
            className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Adicionar ao dashboard
          </button>
        </aside>

        {/* Widgets list */}
        <section className="space-y-4">
          <h3 className="text-[15px] font-bold">Widgets ({widgets.length})</h3>
          {widgets.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground">
              Nenhum widget ainda. Use o painel ao lado para adicionar.
            </div>
          ) : (
            <div className="grid gap-4">
              {widgets.map((w) => (
                <div key={w.id} className="relative">
                  <button
                    onClick={() => removeWidget(w.id)}
                    aria-label="Remover widget"
                    className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={14} />
                  </button>
                  <WidgetRenderer
                    title={w.title}
                    presetId={w.preset as PresetId}
                    chartType={w.chartType}
                    suffix={w.preset === "sla_compliance" ? "%" : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`.input{height:40px;width:100%;border-radius:8px;border:1px solid var(--border);background:var(--card);padding:0 12px;font-size:14px;color:var(--foreground);}.input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px color-mix(in oklch, var(--primary) 12%, transparent);}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
