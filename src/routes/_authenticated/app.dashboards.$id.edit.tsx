import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  getDashboard,
  listWidgets,
  listConnections,
  listDashboards,
  deleteWidget,
  updateDashboard,
  updateWidgetPosition,
  updateWidgetValueScale,
  updateWidgetAlertRule,
  updateWidgetDrilldown,
  subscribe,
  type Connection,
  type Dashboard,
  type Widget,
} from "@/lib/data";
import { ArrowLeft, Plus, Save, Undo2 } from "lucide-react";
import { WidgetGrid } from "@/components/WidgetGrid";
import { WidgetForm } from "@/components/WidgetForm";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/app/dashboards/$id/edit")({
  component: DashboardEditor,
});

function DashboardEditor() {
  const { id } = Route.useParams();
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [conns, setConns] = useState<Connection[]>([]);
  const [allDashboards, setAllDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // Snapshot of positions as they were on first load — used by "Desfazer".
  const baselineRef = useRef<Record<string, { x: number; y: number; w: number; h: number }> | null>(null);
  const [gridKey, setGridKey] = useState(0);
  const hasPending = Object.keys(pending).length > 0;

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [d, ws, cs, ds] = await Promise.all([
          getDashboard(id),
          listWidgets(id),
          currentOrg ? listConnections(currentOrg.id) : Promise.resolve([] as Connection[]),
          currentOrg ? listDashboards(currentOrg.id) : Promise.resolve([] as Dashboard[]),
        ]);
        if (cancelled) return;
        setDashboard(d);
        setWidgets(ws);
        setConns(cs);
        setAllDashboards(ds);
        if (!baselineRef.current) {
          const snap: Record<string, { x: number; y: number; w: number; h: number }> = {};
          for (const w of ws) if (w.position) snap[w.id] = { ...w.position };
          baselineRef.current = snap;
        }
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const unsub = subscribe(() => void refresh());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id, currentOrg]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

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

  const removeWidget = async (wid: string) => {
    try {
      await deleteWidget(wid);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const renameDashboard = async () => {
    const name = window.prompt("Nome do dashboard", dashboard.name);
    if (!name) return;
    try {
      await updateDashboard(dashboard.id, { name });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onLayout = (map: Record<string, { x: number; y: number; w: number; h: number }>) => {
    // Optimistic update only — autosave happens on drag/resize stop via onCommit.
    setWidgets((prev) =>
      prev.map((w) => (map[w.id] ? { ...w, position: { x: map[w.id].x, y: map[w.id].y, w: map[w.id].w, h: map[w.id].h } } : w)),
    );
  };

  const onCommit = async (
    positions: Record<string, { x: number; y: number; w: number; h: number }>,
  ) => {
    // Only persist widgets whose position actually changed.
    const changed: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const w of widgets) {
      const next = positions[w.id];
      if (!next) continue;
      const cur = w.position;
      if (!cur || cur.x !== next.x || cur.y !== next.y || cur.w !== next.w || cur.h !== next.h) {
        changed[w.id] = next;
      }
    }
    if (Object.keys(changed).length === 0) return;
    setPending((prev) => ({ ...prev, ...changed }));
    try {
      await Promise.all(
        Object.entries(changed).map(([wid, p]) => updateWidgetPosition(wid, p)),
      );
      setPending((prev) => {
        const rest = { ...prev };
        for (const k of Object.keys(changed)) delete rest[k];
        return rest;
      });
      toast.success("Posições salvas", { duration: 1200 });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const saveLayout = async () => {
    if (!hasPending) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(pending).map(([wid, p]) =>
          updateWidgetPosition(wid, { x: p.x, y: p.y, w: p.w, h: p.h }),
        ),
      );
      setPending({});
      toast.success("Layout salvo");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const undoLayout = async () => {
    const baseline = baselineRef.current;
    if (!baseline) return;
    if (!window.confirm("Restaurar o layout para a última posição salva ao abrir o editor?")) return;
    setUndoing(true);
    try {
      await Promise.all(
        widgets
          .filter((w) => baseline[w.id])
          .map((w) => updateWidgetPosition(w.id, baseline[w.id])),
      );
      setWidgets((prev) =>
        prev.map((w) => (baseline[w.id] ? { ...w, position: { ...baseline[w.id] } } : w)),
      );
      setPending({});
      setGridKey((k) => k + 1);
      toast.success("Layout restaurado");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUndoing(false);
    }
  };

  const finish = async () => {
    if (hasPending) {
      const ok = window.confirm("Você tem alterações não salvas. Salvar antes de sair?");
      if (ok) await saveLayout();
    }
    navigate({ to: "/app/dashboards/$id", params: { id: dashboard.id } });
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
          <p className="mt-1 text-sm text-muted-foreground">
            Editor — arraste e redimensione os widgets. As mudanças salvam automaticamente ao soltar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPending && (
            <span className="text-xs text-muted-foreground">Alterações não salvas</span>
          )}
          <button
            onClick={undoLayout}
            disabled={undoing || !baselineRef.current}
            title="Restaurar a última posição salva"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-40"
          >
            <Undo2 size={14} /> {undoing ? "Restaurando..." : "Desfazer"}
          </button>
          <button
            onClick={saveLayout}
            disabled={!hasPending || saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Save size={14} /> {saving ? "Salvando..." : "Salvar layout"}
          </button>
          <button
            onClick={finish}
            className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
          >
            Concluir
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-[14px] border border-border bg-card p-5 shadow-card h-fit lg:sticky lg:top-20">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={16} className="text-primary" />
            <h3 className="text-[15px] font-bold">Novo widget</h3>
          </div>
          <WidgetForm dashboardId={dashboard.id} connections={conns} />
        </aside>

        <section className="space-y-4">
          <h3 className="text-[15px] font-bold">Widgets ({widgets.length})</h3>
          {widgets.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground">
              Nenhum widget ainda. Use o painel ao lado para adicionar.
            </div>
          ) : (
            <WidgetGrid
              key={gridKey}
              widgets={widgets}
              editable
              onLayoutChange={onLayout}
              onCommit={onCommit}
              onRemove={removeWidget}
              onValueScaleChange={async (wid, scale) => {
                setWidgets((prev) => prev.map((w) => (w.id === wid ? { ...w, valueScale: scale } : w)));
                try {
                  await updateWidgetValueScale(wid, scale);
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
              onAlertRuleChange={async (wid, rule) => {
                setWidgets((prev) => prev.map((w) => (w.id === wid ? { ...w, alertRule: rule } : w)));
                try {
                  await updateWidgetAlertRule(wid, rule);
                  toast.success(rule ? "Alerta configurado" : "Alerta removido", { duration: 1200 });
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
