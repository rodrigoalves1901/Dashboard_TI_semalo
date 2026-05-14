import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listConnections, type Connection } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { GLPI_TABLES, getTable, type TableDef } from "@/lib/glpi-schema-mock";
import { Database, Table2, Play, KeyRound, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/explorer")({
  component: ExplorerPage,
});

function ExplorerPage() {
  const { currentOrg } = useAuth();
  const [conns, setConns] = useState<Connection[]>([]);
  const [activeConn, setActiveConn] = useState<Connection | null>(null);
  const [activeTable, setActiveTable] = useState<TableDef | null>(null);
  const [results, setResults] = useState<Record<string, string | number | null>[] | null>(null);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    if (!currentOrg) return;
    listConnections(currentOrg.id)
      .then((cs) => {
        setConns(cs);
        if (cs.length > 0) setActiveConn(cs[0]);
      })
      .catch((e) => toast.error((e as Error).message));
  }, [currentOrg]);

  const tables = useMemo(() => {
    if (!activeConn) return [];
    if (activeConn.systemType === "sharepoint") return [];
    // Para qualquer conexão SQL: usa o catálogo mockado por enquanto.
    return GLPI_TABLES;
  }, [activeConn]);

  useEffect(() => {
    setActiveTable(null);
    setResults(null);
    setQuery("");
  }, [activeConn]);

  const runSelect = (sql?: string) => {
    if (!activeTable) return;
    const q = (sql ?? `select * from ${activeTable.name} limit 50`).trim().toLowerCase();
    if (!q.startsWith("select")) return toast.error("Apenas comandos SELECT são permitidos");
    if (/(insert|update|delete|drop|alter|truncate|grant|revoke|;|--)/i.test(q.replace(/limit\s+\d+$/i, ""))) {
      return toast.error("Comando rejeitado");
    }
    // Mock: ignora WHERE e devolve as linhas da tabela.
    setResults(activeTable.rows.slice(0, 50));
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore as tabelas das suas conexões e rode consultas SELECT.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Coluna esquerda: conexões + tabelas */}
        <aside className="space-y-4">
          <section className="rounded-[14px] border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Conexões</h3>
            {conns.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conexão. Adicione uma em Conexões.</p>
            ) : (
              <ul className="space-y-1">
                {conns.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveConn(c)}
                      className={
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors " +
                        (activeConn?.id === c.id
                          ? "bg-accent font-semibold text-accent-foreground"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                      }
                    >
                      <Database size={14} />
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto text-[10px] uppercase">{c.systemType}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[14px] border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tabelas</h3>
            {!activeConn ? (
              <p className="text-xs text-muted-foreground">Selecione uma conexão.</p>
            ) : activeConn.systemType === "sharepoint" ? (
              <p className="text-xs text-muted-foreground">Explorer indisponível para SharePoint.</p>
            ) : (
              <>
                <p className="mb-2 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                  <Info size={11} /> Catálogo mockado (firewall pendente)
                </p>
                <ul className="space-y-1">
                  {tables.map((t) => (
                    <li key={t.name}>
                      <button
                        onClick={() => {
                          setActiveTable(t);
                          setResults(null);
                          setQuery(`select * from ${t.name} limit 50`);
                        }}
                        className={
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-mono transition-colors " +
                          (activeTable?.name === t.name
                            ? "bg-accent font-semibold text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                        }
                      >
                        <Table2 size={12} />
                        {t.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>

        {/* Coluna direita: schema + query */}
        <section className="space-y-4">
          {!activeTable ? (
            <div className="flex h-64 items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground">
              Selecione uma tabela para ver o schema.
            </div>
          ) : (
            <>
              <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-[15px] font-bold">{activeTable.name}</h3>
                    <p className="text-xs text-muted-foreground">{activeTable.description}</p>
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {activeTable.columns.length} colunas
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-muted text-xs font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Coluna</th>
                        <th className="px-3 py-2 text-left">Tipo</th>
                        <th className="px-3 py-2 text-left">Nullable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTable.columns.map((c) => (
                        <tr key={c.name} className="border-t border-border-soft">
                          <td className="flex items-center gap-1 px-3 py-2 font-mono text-foreground">
                            {c.pk && <KeyRound size={11} className="text-primary" />}
                            {c.name}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.type}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{c.nullable ? "yes" : "no"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold">Consulta SQL</h3>
                  <button
                    onClick={() => runSelect(query)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <Play size={12} /> Executar
                  </button>
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Apenas <code>SELECT</code> é permitido. Limit aplicado em 50 linhas.
                </p>
              </div>

              {results && (
                <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-bold">Resultado</h3>
                    <span className="text-xs text-muted-foreground">{results.length} linhas</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-muted text-xs font-semibold text-muted-foreground">
                        <tr>
                          {activeTable.columns.map((c) => (
                            <th key={c.name} className="px-3 py-2 text-left font-mono">{c.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((row, i) => (
                          <tr key={i} className="border-t border-border-soft">
                            {activeTable.columns.map((c) => (
                              <td key={c.name} className="px-3 py-2 font-mono text-xs text-foreground">
                                {row[c.name] === null || row[c.name] === undefined ? (
                                  <span className="text-muted-foreground">NULL</span>
                                ) : (
                                  String(row[c.name])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// Acesso indireto a getTable só para evitar warning unused.
void getTable;
