import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listConnections,
  deleteConnection,
  subscribe,
  type Connection,
} from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { Database, Plus, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/connections")({
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const { currentOrg } = useAuth();
  const [conns, setConns] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, "ok" | "fail">>({});

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!currentOrg) {
        setConns([]);
        setLoading(false);
        return;
      }
      try {
        const list = await listConnections(currentOrg.id);
        if (!cancelled) setConns(list);
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

  const remove = async (id: string) => {
    if (!confirm("Remover esta conexão?")) return;
    try {
      await deleteConnection(id);
      toast.success("Conexão removida");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const test = async (c: Connection) => {
    setTesting(c.id);
    await new Promise((r) => setTimeout(r, 900));
    const ok = c.host.length > 0 && c.port > 0;
    setStatus((s) => ({ ...s, [c.id]: ok ? "ok" : "fail" }));
    setTesting(null);
    toast[ok ? "success" : "error"](ok ? "Conexão bem-sucedida (simulada)" : "Falha ao conectar");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conexões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Conecte-se aos bancos dos seus sistemas (GLPI, MySQL, etc) via IP e porta.
          </p>
        </div>
        <Link
          to="/app/connections/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} /> Nova conexão
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : conns.length === 0 ? (
        <Link
          to="/app/connections/new"
          className="flex h-40 w-full items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex flex-col items-center gap-2">
            <Database size={20} />
            Adicionar primeira conexão
          </div>
        </Link>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Sistema</th>
                <th className="px-4 py-3 text-left">Host</th>
                <th className="px-4 py-3 text-left">Banco</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {conns.map((c) => {
                const st = status[c.id];
                return (
                  <tr key={c.id} className="border-t border-border-soft hover:bg-surface-muted">
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground uppercase">{c.systemType}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {c.host}:{c.port}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.database}</td>
                    <td className="px-4 py-3">
                      {st === "ok" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <Wifi size={12} /> Conectado
                        </span>
                      ) : st === "fail" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                          <WifiOff size={12} /> Falha
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => test(c)}
                          disabled={testing === c.id}
                          className="h-8 rounded-md border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                        >
                          {testing === c.id ? "Testando..." : "Testar"}
                        </button>
                        <button
                          onClick={() => remove(c.id)}
                          className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                          aria-label="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
