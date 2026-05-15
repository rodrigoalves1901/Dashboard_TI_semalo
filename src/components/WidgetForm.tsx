import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { createWidget, type ChartType, type Connection } from "@/lib/data";
import { PRESETS, getPreset, type PresetId } from "@/lib/glpi-presets";
import { WidgetRenderer } from "./WidgetRenderer";

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "metric", label: "Métrica" },
  { value: "bar", label: "Barras" },
  { value: "line", label: "Linha" },
  { value: "donut", label: "Donut" },
  { value: "table", label: "Tabela" },
  { value: "markdown", label: "Texto/Markdown" },
  { value: "divider", label: "Divisória" },
];

type Props = {
  dashboardId: string;
  connections: Connection[];
  onCreated?: () => void;
};

export function WidgetForm({ dashboardId, connections, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [presetId, setPresetId] = useState<PresetId>("tickets_open");
  const [chartType, setChartType] = useState<ChartType>("metric");
  const [connectionId, setConnectionId] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const isText = chartType === "markdown" || chartType === "divider";

  useEffect(() => {
    if (isText) return;
    const p = getPreset(presetId);
    if (p) {
      setChartType(p.defaultChart);
      if (!title) setTitle(p.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  const submit = async () => {
    if (chartType !== "divider" && !title.trim() && chartType !== "markdown") return toast.error("Defina um título");
    if (chartType === "markdown" && !content.trim()) return toast.error("Escreva algum conteúdo");
    setSaving(true);
    try {
      await createWidget({
        dashboardId,
        connectionId: isText ? null : (connectionId || null),
        title: title.trim() || (chartType === "divider" ? "" : "Widget"),
        chartType,
        preset: isText ? "" : presetId,
        refreshInterval: isText ? 0 : 60,
        position: null,
        content: chartType === "markdown" ? content : null,
      });
      toast.success("Widget adicionado");
      setTitle("");
      setContent("");
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Conexão">
        <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="wf-input">
          <option value="">— Sem conexão (dados de exemplo) —</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.systemType})
            </option>
          ))}
        </select>
        {connections.length === 0 && (
          <Link to="/app/connections/new" className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">
            + Adicionar conexão
          </Link>
        )}
      </Field>

      <Field label="Métrica / Consulta">
        <select value={presetId} onChange={(e) => setPresetId(e.target.value as PresetId)} className="wf-input">
          {(["Tickets", "SLA", "Operação"] as const).map((cat) => (
            <optgroup key={cat} label={cat}>
              {PRESETS.filter((p) => p.category === cat).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-muted-foreground">{getPreset(presetId)?.description}</span>
      </Field>

      <Field label="Tipo de gráfico">
        <div className="grid grid-cols-3 gap-2">
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="wf-input" />
      </Field>

      <div className="rounded-lg border border-dashed border-border-soft p-3">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pré-visualização</span>
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
        onClick={submit}
        disabled={saving}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Plus size={14} /> {saving ? "Salvando..." : "Adicionar ao dashboard"}
      </button>

      <style>{`.wf-input{height:40px;width:100%;border-radius:8px;border:1px solid var(--border);background:var(--card);padding:0 12px;font-size:14px;color:var(--foreground);}.wf-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px color-mix(in oklch, var(--primary) 12%, transparent);}`}</style>
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
