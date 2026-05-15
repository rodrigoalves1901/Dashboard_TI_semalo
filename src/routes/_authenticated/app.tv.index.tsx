import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listDashboards, subscribe, type Dashboard } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { Tv, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/tv/")({
  component: TvIndex,
});

const KEY = "flup.tvIntervalSeconds";

function TvIndex() {
  const { currentOrg } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setIntervalSec] = useState(160);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = Number(window.localStorage.getItem(KEY));
      if (Number.isFinite(v) && v > 0) setIntervalSec(v);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!currentOrg) return;
      try {
        const list = await listDashboards(currentOrg.id);
        if (!cancelled) setDashboards(list);
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
  }, [currentOrg]);

  const updateInterval = (n: number) => {
    setIntervalSec(n);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, String(n));
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Modo TV</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Abra um dashboard em tela cheia, com atualização automática.
        </p>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted-foreground">
          Atualizar a cada (segundos)
        </label>
        <input
          type="number"
          min={10}
          max={3600}
          value={interval}
          onChange={(e) => updateInterval(Math.max(10, Number(e.target.value) || 10))}
          className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : dashboards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum dashboard nesta organização.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dashboards.map((d) => (
            <div key={d.id} className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Tv size={18} />
              </div>
              <h3 className="mt-4 text-base font-bold">{d.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Criado em {new Date(d.createdAt).toLocaleDateString("pt-BR")}
              </p>
              <Link
                to="/app/tv/$id"
                params={{ id: d.id }}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Play size={14} /> Iniciar Modo TV
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
