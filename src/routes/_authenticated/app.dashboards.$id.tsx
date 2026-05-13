import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, subscribe, type Dashboard, type Widget } from "@/lib/storage";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { WidgetRenderer } from "@/components/WidgetRenderer";
import { getPreset, type PresetId } from "@/lib/glpi-presets";

export const Route = createFileRoute("/_authenticated/app/dashboards/$id")({
  component: DashboardView,
});

function DashboardView() {
  const { id } = Route.useParams();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);

  useEffect(() => {
    const refresh = () => {
      const d = db.listDashboards().find((x) => x.id === id) ?? null;
      setDashboard(d);
      setWidgets(db.listWidgets().filter((w) => w.dashboardId === id));
    };
    refresh();
    return subscribe(refresh);
  }, [id]);

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

  // Split metrics from charts for nicer layout
  const metrics = widgets.filter((w) => w.chartType === "metric");
  const charts = widgets.filter((w) => w.chartType !== "metric");

  return (
    <div className="space-y-6">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Dashboards
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="mt-1 text-sm text-muted-foreground">{dashboard.description}</p>
          )}
        </div>
        <Link
          to="/app/dashboards/$id/edit"
          params={{ id: dashboard.id }}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
        >
          <Pencil size={14} /> Editar dashboard
        </Link>
      </header>

      {widgets.length === 0 ? (
        <Link
          to="/app/dashboards/$id/edit"
          params={{ id: dashboard.id }}
          className="flex h-40 w-full items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex flex-col items-center gap-2">
            <Plus size={20} />
            Adicionar primeiro widget
          </div>
        </Link>
      ) : (
        <>
          {metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {metrics.map((w) => {
                const preset = getPreset(w.preset);
                return preset ? (
                  <WidgetRenderer
                    key={w.id}
                    title={w.title}
                    presetId={w.preset as PresetId}
                    chartType={w.chartType}
                    suffix={preset.id === "sla_compliance" ? "%" : undefined}
                  />
                ) : null;
              })}
            </div>
          )}

          {charts.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {charts.map((w) => (
                <WidgetRenderer
                  key={w.id}
                  title={w.title}
                  presetId={w.preset as PresetId}
                  chartType={w.chartType}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
