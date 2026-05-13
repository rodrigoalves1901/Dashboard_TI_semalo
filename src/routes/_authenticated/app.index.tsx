import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { db, subscribe, uid, type Dashboard } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { Plus, LayoutDashboard, MoreHorizontal, Trash2 } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { mockData } from "@/lib/glpi-presets";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardsHome,
});

function DashboardsHome() {
  const { currentOrg, user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);

  useEffect(() => {
    const refresh = () => {
      if (!currentOrg) return setDashboards([]);
      setDashboards(db.listDashboards().filter((d) => d.orgId === currentOrg.id));
    };
    refresh();
    return subscribe(refresh);
  }, [currentOrg]);

  const create = () => {
    if (!currentOrg) return;
    const name = window.prompt("Nome do dashboard", "Novo dashboard");
    if (!name) return;
    const d: Dashboard = {
      id: uid(),
      orgId: currentOrg.id,
      name,
      description: "",
      createdAt: new Date().toISOString(),
    };
    db.saveDashboards([...db.listDashboards(), d]);
    toast.success("Dashboard criado");
  };

  const remove = (id: string) => {
    if (!confirm("Remover este dashboard?")) return;
    db.saveDashboards(db.listDashboards().filter((d) => d.id !== id));
    db.saveWidgets(db.listWidgets().filter((w) => w.dashboardId !== id));
    toast.success("Dashboard removido");
  };

  const opened = mockData("tickets_open");
  const solved = mockData("tickets_solved");
  const pending = mockData("tickets_pending");
  const late = mockData("tickets_late");
  const sla = mockData("sla_compliance");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Olá, {user?.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão geral dos seus dashboards em <strong>{currentOrg?.name}</strong>.
          </p>
        </div>
        <button
          onClick={create}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} /> Novo dashboard
        </button>
      </header>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">Métricas em destaque</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Tickets em aberto" value={opened.value!} delta={opened.delta} />
          <MetricCard label="Resolvidos (30d)" value={solved.value!} delta={solved.delta} />
          <MetricCard label="Pendentes" value={pending.value!} delta={pending.delta} />
          <MetricCard label="Atrasados" value={late.value!} delta={late.delta} />
          <MetricCard label="SLA" value={sla.value!} delta={sla.delta} suffix="%" />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Seus dashboards</h2>
          <span className="text-xs text-muted-foreground">{dashboards.length} total</span>
        </div>

        {dashboards.length === 0 ? (
          <button
            onClick={create}
            className="flex h-40 w-full items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex flex-col items-center gap-2">
              <Plus size={20} />
              Criar seu primeiro dashboard
            </div>
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dashboards.map((d) => (
              <div key={d.id} className="group rounded-[14px] border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-popover">
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <LayoutDashboard size={18} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="grid h-8 w-8 place-items-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-secondary">
                      <MoreHorizontal size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => remove(d.id)} className="text-destructive">
                        <Trash2 size={14} className="mr-2" /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="mt-4 text-base font-bold">{d.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Criado em {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/app/dashboards/$id"
                    params={{ id: d.id }}
                    className="h-9 flex-1 inline-flex items-center justify-center rounded-lg border border-border text-xs font-semibold hover:bg-secondary"
                  >
                    Abrir
                  </Link>
                  <Link
                    to="/app/dashboards/$id/edit"
                    params={{ id: d.id }}
                    className="h-9 flex-1 inline-flex items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
