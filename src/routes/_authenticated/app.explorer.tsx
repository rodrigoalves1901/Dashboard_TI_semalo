import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listConnections, type Connection } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { GLPI_TABLES, getTable, type TableDef } from "@/lib/glpi-schema-mock";
import { getDatabaseSchema, runExplorerQuery } from "@/lib/explorer.functions";
import { Database, Table2, Play, KeyRound, Info, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { SaveWidgetDialog } from "@/components/SaveWidgetDialog";
import { Button } from "@/components/ui/button";

const SCHEMA_CACHE_KEY = "digitaldash_explorer_schemas";
const EXPLORER_STATE_KEY = "digitaldash_explorer_state";

interface PersistentState {
  activeConnId?: string;
  activeTableName?: string;
  query?: string;
}

function getExplorerState(): PersistentState {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(EXPLORER_STATE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function setExplorerState(state: PersistentState) {
  if (typeof window === "undefined") return;
  const current = getExplorerState();
  localStorage.setItem(EXPLORER_STATE_KEY, JSON.stringify({ ...current, ...state }));
}

function getPersistentCache(): Record<string, { tables: TableDef[]; updatedAt: string }> {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(SCHEMA_CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function setPersistentCache(connId: string, tables: TableDef[]) {
  if (typeof window === "undefined") return;
  try {
    const cache = getPersistentCache();
    cache[connId] = { tables, updatedAt: new Date().toISOString() };
    localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn("Falha ao salvar cache no localStorage:", e);
  }
}

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
  const [tables, setTables] = useState<TableDef[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [runningQuery, setRunningQuery] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");

  const filteredTables = useMemo(() => {
    return tables.filter((t) => t.name.toLowerCase().includes(tableSearch.toLowerCase()));
  }, [tables, tableSearch]);

  // 1. Carregar conexões e restaurar última conexão ativa
  useEffect(() => {
    if (!currentOrg) return;
    listConnections(currentOrg.id)
      .then((cs) => {
        setConns(cs);
        const state = getExplorerState();
        const savedConn = cs.find((c) => c.id === state.activeConnId);
        if (savedConn) {
          setActiveConn(savedConn);
        } else if (cs.length > 0) {
          setActiveConn(cs[0]);
        }
      })
      .catch((e) => toast.error((e as Error).message));
  }, [currentOrg]);

  const fetchTables = (force = false) => {
    if (!activeConn || activeConn.systemType === "sharepoint") return;

    const cache = getPersistentCache();
    const entry = cache[activeConn.id];

    if (!force && entry) {
      setTables(entry.tables);
      setLastUpdated(entry.updatedAt);
      return;
    }

    setLoadingTables(true);
    getDatabaseSchema({ data: { connectionId: activeConn.id } })
      .then((schema) => {
        setPersistentCache(activeConn.id, schema as any);
        setTables(schema as any);
        setLastUpdated(new Date().toISOString());
      })
      .catch((e) => {
        toast.error("Falha ao carregar tabelas: " + (e as Error).message);
      })
      .finally(() => {
        setLoadingTables(false);
      });
  };

  // 2. Quando a conexão ativa muda, restaurar tabelas e estado anterior
  useEffect(() => {
    if (!activeConn) return;

    setExplorerState({ activeConnId: activeConn.id });

    const cache = getPersistentCache();
    const entry = cache[activeConn.id];

    if (entry) {
      setTables(entry.tables);
      setLastUpdated(entry.updatedAt);

      // Tentar restaurar a última tabela e query
      const state = getExplorerState();
      if (state.activeTableName) {
        const table = entry.tables.find((t) => t.name === state.activeTableName);
        if (table) {
          setActiveTable(table);
          setQuery(state.query || `select * from ${table.name} limit 50`);
        } else {
          setQuery(state.query || "");
        }
      } else {
        setQuery(state.query || "");
      }
    } else {
      setTables([]);
      setActiveTable(null);
      setQuery("");
      fetchTables();
    }
  }, [activeConn]);

  // 3. Persistir query e tabela conforme mudam
  useEffect(() => {
    setExplorerState({
      activeTableName: activeTable?.name,
      query,
    });
  }, [activeTable, query]);

  const runSelect = async (sql?: string) => {
    if (!activeConn) return;
    const q = (sql ?? query).trim();
    if (!q) return;

    setRunningQuery(true);
    try {
      const res = await runExplorerQuery({ data: { connectionId: activeConn.id, query: q } });
      setResults(res as any);
    } catch (err) {
      toast.error("Erro na consulta: " + (err as Error).message);
    } finally {
      setRunningQuery(false);
    }
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
        <aside className="space-y-4">
          <section className="rounded-[14px] border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Conexões
            </h3>
            {conns.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma conexão. Adicione uma em Conexões.
              </p>
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

          <section className="flex flex-col h-[600px] rounded-[14px] border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Tabelas
              </h3>
              {activeConn && activeConn.systemType !== "sharepoint" && (
                <div className="flex items-center gap-2">
                  {lastUpdated && !loadingTables && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(lastUpdated).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={() => fetchTables(true)}
                    disabled={loadingTables}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={loadingTables ? "animate-spin" : ""} />
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Filtrar tabelas..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {!activeConn ? (
                <p className="text-xs text-muted-foreground">Selecione uma conexão.</p>
              ) : activeConn.systemType === "sharepoint" ? (
                <p className="text-xs text-muted-foreground">
                  Explorer indisponível para SharePoint.
                </p>
              ) : (
                <>
                  {activeConn.systemType === "demo" && (
                    <p className="mb-2 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                      <Info size={11} /> Catálogo mockado (Modo Demo)
                    </p>
                  )}
                  {loadingTables && tables.length === 0 ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 size={12} className="animate-spin" /> Carregando tabelas...
                    </p>
                  ) : filteredTables.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma tabela encontrada.</p>
                  ) : (
                    <ul className="space-y-1">
                      {filteredTables.map((t) => (
                        <li key={t.name}>
                          <button
                            onClick={() => {
                              setActiveTable(t);
                              setResults(null);
                              setQuery(`select * from ${t.name} limit 50`);
                            }}
                            className={
                              "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs font-mono transition-colors " +
                              (activeTable?.name === t.name
                                ? "bg-accent font-semibold text-accent-foreground"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                            }
                          >
                            <Table2 size={12} className="shrink-0 mt-[2px]" />
                            <span className="break-all">{t.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>

        {/* Coluna direita: schema + query */}
        <section className="space-y-4 min-w-0">
          {!activeConn ? (
            <div className="flex h-64 items-center justify-center rounded-[14px] border border-dashed border-border-soft text-sm text-muted-foreground">
              Selecione uma conexão para começar.
            </div>
          ) : (
            <>
              {/* Editor SQL sempre visível se houver conexão */}
              <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold">Consulta SQL</h3>
                  <div className="flex items-center gap-2">
                    {results && results.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSaveDialogOpen(true)}
                        className="h-9 gap-2"
                      >
                        <Save size={14} /> Salvar como Widget
                      </Button>
                    )}
                    <button
                      onClick={() => runSelect(query)}
                      disabled={runningQuery}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      {runningQuery ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}{" "}
                      Executar
                    </button>
                  </div>
                </div>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SELECT * FROM tabela LIMIT 50"
                  spellCheck="false"
                  className="w-full min-h-[160px] rounded-lg border border-border bg-background p-4 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Apenas consultas de leitura (SELECT ou WITH) são permitidas por segurança.
                </p>
              </div>

              {/* Schema da tabela selecionada */}
              {activeTable ? (
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
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-muted text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                        <tr>
                          <th className="px-3 py-2 text-left">Coluna</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-left">Nullable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTable.columns.map((c) => (
                          <tr
                            key={c.name}
                            className="border-t border-border-soft hover:bg-muted/30"
                          >
                            <td className="flex items-center gap-1 px-3 py-2 font-mono text-foreground">
                              {c.pk && <KeyRound size={11} className="text-primary" />}
                              {c.name}
                            </td>
                            <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                              {c.type}
                            </td>
                            <td className="px-3 py-2 text-[10px] text-muted-foreground">
                              {c.nullable ? "yes" : "no"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-[14px] border border-dashed border-border-soft text-xs text-muted-foreground italic bg-muted/5">
                  Selecione uma tabela para ver o esquema detalhado.
                </div>
              )}

              {/* Resultados */}
              {results && (
                <div className="rounded-[14px] border border-border bg-card p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[15px] font-bold">Resultado</h3>
                    <span className="text-xs text-muted-foreground">{results.length} linhas</span>
                  </div>
                  <div className="overflow-x-auto border rounded-lg max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm shadow-sm z-10">
                        <tr className="border-b border-border">
                          {results.length > 0 ? (
                            Object.keys(results[0]).map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))
                          ) : (
                            <th className="px-3 py-2 text-left font-mono">Sem dados</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((row, i) => (
                          <tr
                            key={i}
                            className="border-t border-border-soft hover:bg-muted/50 transition-colors"
                          >
                            {Object.keys(row).map((col) => (
                              <td key={col} className="px-3 py-2 font-mono whitespace-nowrap">
                                {row[col] === null || row[col] === undefined ? (
                                  <span className="text-muted-foreground/30 italic">NULL</span>
                                ) : typeof row[col] === "object" ? (
                                  <span className="text-[10px] opacity-60">
                                    {JSON.stringify(row[col])}
                                  </span>
                                ) : (
                                  String(row[col])
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

      {activeConn && (
        <SaveWidgetDialog
          open={isSaveDialogOpen}
          onOpenChange={setIsSaveDialogOpen}
          orgId={currentOrg?.id || ""}
          connectionId={activeConn.id}
          query={query}
        />
      )}
    </div>
  );
}

// Acesso indireto a getTable só para evitar warning unused.
void getTable;
