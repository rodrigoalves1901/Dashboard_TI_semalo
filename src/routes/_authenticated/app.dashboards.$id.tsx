import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getDashboard,
  listWidgets,
  listConnections,
  subscribe,
  type Connection,
  type Dashboard,
  type Widget,
} from "@/lib/data";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { WidgetGrid } from "@/components/WidgetGrid";
import { WidgetForm } from "@/components/WidgetForm";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/dashboards/$id")({
  component: DashboardView,
});

function DashboardView() {
  const { id } = Route.useParams();
  const { currentOrg } = useAuth();
  const childMatches = useChildMatches();
  const hasChild = childMatches.length > 0;
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [conns, setConns] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const [d, ws, cs] = await Promise.all([
          getDashboard(id),
          listWidgets(id),
          currentOrg ? listConnections(currentOrg.id) : Promise.resolve([] as Connection[]),
        ]);
        if (cancelled) return;
        setDashboard(d);
        setWidgets(ws);
        setConns(cs);
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

  if (hasChild) return <Outlet />;

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
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Plus size={14} /> Adicionar widget
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo widget</DialogTitle>
              </DialogHeader>
              <WidgetForm
                dashboardId={dashboard.id}
                connections={conns}
                onCreated={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <Link
            to="/app/dashboards/$id/edit"
            params={{ id: dashboard.id }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
          >
            <Pencil size={14} /> Editar dashboard
          </Link>
        </div>
      </header>

      {widgets.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="flex h-40 w-full items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex flex-col items-center gap-2">
            <Plus size={20} />
            Adicionar primeiro widget
          </div>
        </button>
      ) : (
        <WidgetGrid widgets={widgets} editable={false} />
      )}
    </div>
  );
}
