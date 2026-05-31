import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  createWidget,
  updateWidget,
  listCustomMetrics,
  createCustomMetric,
  type ChartType,
  type Connection,
  type Widget,
  type CustomMetric,
} from "@/lib/data";
import { PRESETS, getPreset, type PresetId } from "@/lib/glpi-presets";
import { useAuth } from "@/hooks/use-auth";
import { WidgetRenderer } from "./WidgetRenderer";
import {
  Bold,
  AlignCenter,
  AlignLeft,
  Palette,
  Save,
  Settings2,
  BarChart3,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "metric", label: "Métrica" },
  { value: "bar", label: "Barras" },
  { value: "line", label: "Linha" },
  { value: "donut", label: "Donut" },
  { value: "composed", label: "Gráfico Misto (Barra + Linha)" },
  { value: "table", label: "Tabela" },
  { value: "markdown", label: "Texto/Markdown" },
  { value: "divider", label: "Divisória" },
];

type Props = {
  dashboardId: string;
  connections: Connection[];
  onCreated?: () => void;
  initialData?: Widget;
};

export function WidgetForm({ dashboardId, connections, onCreated, initialData }: Props) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [presetId, setPresetId] = useState<PresetId>(
    (initialData?.preset as PresetId) || "tickets_open",
  );
  const [chartType, setChartType] = useState<ChartType>(initialData?.chartType || "metric");
  const [connectionId, setConnectionId] = useState<string>(initialData?.connectionId || "");
  const [content, setContent] = useState<string>(initialData?.content || "");
  const [valueScale, setValueScale] = useState<number>(initialData?.valueScale || 1);
  const [styles, setStyles] = useState(initialData?.styles || {});
  const [saving, setSaving] = useState(false);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [sqlKeys, setSqlKeys] = useState<string[]>(() => {
    if (initialData?.styles?.seriesMapping) {
      return Object.keys(initialData.styles.seriesMapping);
    }
    return [];
  });
  const [loadingKeys, setLoadingKeys] = useState(false);
  const { currentOrg } = useAuth();

  const selectedConn = connections.find((c) => c.id === connectionId);
  const isText = chartType === "markdown" || chartType === "divider";

  useEffect(() => {
    if (currentOrg) {
      listCustomMetrics(currentOrg.id).then(setCustomMetrics).catch(console.error);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (isText || presetId === "custom_sql") return;
    const p = getPreset(presetId);
    if (p) {
      setChartType(p.defaultChart);
      if (!title) setTitle(p.label);
      setContent(p.sql || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  const saveAsMetric = async () => {
    if (!currentOrg) return;
    if (!content.trim()) return toast.error("Escreva um SQL primeiro");
    if (!title.trim()) return toast.error("Dê um título ao widget para salvar a métrica");

    const name = prompt("Nome da métrica personalizada:", title) || title;

    try {
      await createCustomMetric({
        orgId: currentOrg.id,
        connectionId: connectionId || null,
        name,
        sqlQuery: content,
        category: "Personalizado",
      });
      toast.success("Métrica salva com sucesso!");
      const updated = await listCustomMetrics(currentOrg.id);
      setCustomMetrics(updated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handlePresetChange = (pid: string) => {
    if (pid === "custom_sql") {
      setPresetId("custom_sql");
      return;
    }

    const custom = customMetrics.find((m) => m.id === pid);
    if (custom) {
      setPresetId("custom_sql");
      setContent(custom.sqlQuery);
      if (!title) setTitle(custom.name);
      return;
    }
    setPresetId(pid as PresetId);
    const p = getPreset(pid as PresetId);
    if (p) {
      setTitle(p.label);
      setContent(p.sql || "");
    }
  };

  const loadSqlKeys = async () => {
    if (!connectionId || !content.trim()) return;
    setLoadingKeys(true);
    try {
      const { runExplorerQuery } = await import("@/lib/explorer.functions");
      const res = await runExplorerQuery({ data: { connectionId, query: content } });
      if (res && res.length > 0) {
        const isGroupedMode =
          chartType === "bar" &&
          styles.barGroupMode &&
          styles.barGroupMode !== "simple" &&
          Object.keys(res[0]).length >= 3;

        if (isGroupedMode) {
          // Modo pivot: chaves são os valores únicos da 2ª coluna (a dimensão de agrupamento)
          const groupColKey = Object.keys(res[0])[1];
          const uniqueGroups = Array.from(
            new Set(
              res.map((r) => {
                const val = (r as Record<string, unknown>)[groupColKey];
                return val === null || val === undefined ? "null" : String(val);
              }),
            ),
          );
          setSqlKeys(uniqueGroups);
        } else if (chartType === "table" || chartType === "composed" || chartType === "line") {
          setSqlKeys(Object.keys(res[0]));
        } else {
          // Para gráficos de barras ou de donut (modo simples)
          if (res.length === 1 && Object.keys(res[0]).length > 1) {
            setSqlKeys(Object.keys(res[0]));
          } else {
            const rowKeys = res.map((r) => {
              const val = Object.values(r)[0];
              return val === null || val === undefined ? "null" : String(val);
            });
            setSqlKeys(Array.from(new Set(rowKeys)));
          }
        }
      }
    } catch (err) {
      toast.error("Não foi possível carregar colunas: " + (err as Error).message);
    } finally {
      setLoadingKeys(false);
    }
  };

  const updateSeriesMapping = (
    key: string,
    updates: {
      label?: string;
      color?: string;
      hidden?: boolean;
      showInFooter?: boolean;
      blink?: boolean;
    },
  ) => {
    setStyles((s) => ({
      ...s,
      seriesMapping: {
        ...(s.seriesMapping || {}),
        [key]: { ...(s.seriesMapping?.[key] || {}), ...updates },
      },
    }));
  };

  const submit = async () => {
    if (chartType !== "divider" && !title.trim() && chartType !== "markdown")
      return toast.error("Defina um título");
    if (chartType === "markdown" && !content.trim()) return toast.error("Escreva algum conteúdo");
    if (presetId === "custom_sql" && !isText && !content.trim())
      return toast.error("Escreva a sua consulta SQL");
    setSaving(true);
    try {
      const data = {
        title: title.trim() || (chartType === "divider" ? "" : "Widget"),
        description: description.trim() || null,
        chartType,
        connectionId: isText ? null : connectionId || null,
        preset: isText ? "" : presetId,
        content: chartType === "markdown" || presetId === "custom_sql" ? content : null,
        valueScale: chartType === "metric" ? valueScale : 1,
        styles,
      };

      if (initialData) {
        await updateWidget(initialData.id, data);
        toast.success("Widget atualizado");
      } else {
        await createWidget({
          ...data,
          dashboardId,
          refreshInterval: isText ? 0 : 60,
          position: null,
        });
        toast.success("Widget adicionado");
        setTitle("");
        setDescription("");
        setContent("");
      }
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Tipo">
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

      {!isText && (
        <>
          <Field label="Conexão">
            <select
              value={connectionId}
              onChange={(e) => {
                const cid = e.target.value;
                setConnectionId(cid);
                const conn = connections.find((c) => c.id === cid);
                const isGlpiCompatible =
                  conn?.systemType === "mysql" ||
                  conn?.systemType === "mariadb" ||
                  conn?.systemType === "demo";
                if (!isGlpiCompatible && presetId !== "custom_sql") {
                  setPresetId("custom_sql");
                }
              }}
              className="wf-input"
            >
              <option value="">— Sem conexão (dados de exemplo) —</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.systemType})
                </option>
              ))}
            </select>
            {connections.length === 0 && (
              <Link
                to="/app/connections/new"
                className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline"
              >
                + Adicionar conexão
              </Link>
            )}
          </Field>

          <Field label="Métrica / Consulta">
            <select
              value={presetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="wf-input"
            >
              <option value="custom_sql">Consulta Customizada (SQL)</option>
              {customMetrics.filter((m) => !m.connectionId || m.connectionId === connectionId)
                .length > 0 && (
                <optgroup label="Minhas Consultas">
                  {customMetrics
                    .filter((m) => !m.connectionId || m.connectionId === connectionId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {(selectedConn?.systemType === "mysql" ||
                selectedConn?.systemType === "mariadb" ||
                selectedConn?.systemType === "demo") &&
                (["Tickets", "SLA", "Operação"] as const).map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {PRESETS.filter((p) => p.category === cat).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            {presetId !== "custom_sql" && (
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {getPreset(presetId)?.description}
              </span>
            )}
          </Field>

          {presetId === "custom_sql" && (
            <Field label="Sua consulta SQL">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="wf-input min-h-[120px] pr-10 font-mono text-[11px]"
                  style={{ padding: 12, lineHeight: 1.5 }}
                  placeholder="SELECT count(*) as value FROM glpi_tickets"
                />
                <button
                  type="button"
                  onClick={saveAsMetric}
                  title="Salvar esta consulta para reutilizar"
                  className="absolute bottom-3 right-3 rounded-md bg-primary/10 p-2 text-primary hover:bg-primary/20"
                >
                  <Save size={14} />
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground italic">
                Dica: O retorno do SQL deve conter uma coluna chamada <strong>value</strong> para
                métricas simples.
              </p>
            </Field>
          )}
        </>
      )}

      {chartType !== "divider" && (
        <Field label={chartType === "markdown" ? "Título (opcional)" : "Título do widget"}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="wf-input" />
        </Field>
      )}

      {chartType !== "divider" && (
        <Field label="Descrição / Informações (Filtros, regras, etc.)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="wf-input min-h-[60px]"
            style={{ padding: "8px 12px", height: "auto" }}
            placeholder="Ex.: Filtro aplicado: Entity = 1, computadores ativos nos últimos 30 dias."
          />
        </Field>
      )}

      {chartType === "divider" && (
        <Field label="Rótulo da divisória (opcional)">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="wf-input"
            placeholder="Ex.: Visão geral"
          />
        </Field>
      )}

      {chartType === "markdown" && (
        <Field label="Conteúdo (Markdown)">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="wf-input"
            style={{
              height: 180,
              padding: 12,
              lineHeight: 1.5,
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
            }}
            placeholder={
              "## Título\n\nTexto, **negrito**, [links](https://...)\n\n![imagem](https://exemplo.com/img.png)"
            }
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Suporta markdown completo. Imagens via <code>![alt](url)</code>.
          </span>
        </Field>
      )}

      {chartType === "metric" && (
        <Field label={`Tamanho do valor (${Math.round(valueScale * 100)}%)`}>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.25}
            value={valueScale}
            onChange={(e) => setValueScale(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Aumente para destacar o número em telas grandes ou no modo TV.
          </span>
        </Field>
      )}

      {chartType !== "divider" && chartType !== "markdown" && (
        <Field label="Estilos Adicionais">
          <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
            {/* Tamanho Título */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  Tamanho do Título
                </span>
                <span className="text-[10px] font-bold text-primary">
                  {Math.round((styles.titleSize || 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={styles.titleSize || 1}
                onChange={(e) => setStyles((s) => ({ ...s, titleSize: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>

            {/* Negrito e Alinhamento */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStyles((s) => ({ ...s, titleBold: !s.titleBold }))}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-[11px] font-semibold transition-colors",
                  styles.titleBold
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                <Bold size={12} /> Negrito
              </button>
              <button
                type="button"
                onClick={() => setStyles((s) => ({ ...s, centerTitle: !s.centerTitle }))}
                className={cn(
                  "flex h-8 w-10 items-center justify-center rounded-md border transition-colors",
                  styles.centerTitle
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
                title="Centralizar Título"
              >
                {styles.centerTitle ? <AlignCenter size={14} /> : <AlignLeft size={14} />}
              </button>
              {chartType === "metric" && (
                <button
                  type="button"
                  onClick={() => setStyles((s) => ({ ...s, centerValue: !s.centerValue }))}
                  className={cn(
                    "flex h-8 w-10 items-center justify-center rounded-md border transition-colors",
                    styles.centerValue
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary",
                  )}
                  title="Centralizar Valor"
                >
                  {styles.centerValue ? <AlignCenter size={16} /> : <AlignLeft size={16} />}
                </button>
              )}
            </div>

            {/* Mostrar Valores & Animações */}
            {(chartType === "bar" ||
              chartType === "line" ||
              chartType === "donut" ||
              chartType === "composed") && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStyles((s) => ({ ...s, showValues: !s.showValues }))}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md border px-3 text-[11px] font-semibold transition-colors",
                    styles.showValues
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <div
                    className={cn(
                      "h-3 w-3 rounded-sm border",
                      styles.showValues ? "bg-primary border-primary" : "border-muted-foreground",
                    )}
                  >
                    {styles.showValues && <Check size={10} className="text-white" />}
                  </div>
                  {chartType === "donut"
                    ? "Mostrar valores nas fatias"
                    : "Mostrar valores no gráfico"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setStyles((s) => ({ ...s, disableAnimations: !s.disableAnimations }))
                  }
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md border px-3 text-[11px] font-semibold transition-colors",
                    styles.disableAnimations
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  <div
                    className={cn(
                      "h-3 w-3 rounded-sm border",
                      styles.disableAnimations
                        ? "bg-primary border-primary"
                        : "border-muted-foreground",
                    )}
                  >
                    {styles.disableAnimations && <Check size={10} className="text-white" />}
                  </div>
                  Desativar animações (evita piscar)
                </button>
              </div>
            )}

            {/* Modo de Agrupamento de Barras */}
            {chartType === "bar" && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  Modo de Exibição das Barras
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Use <strong>Agrupado</strong> ou <strong>Empilhado</strong> quando seu SQL
                  retornar 3 colunas: eixo X, categoria e valor.
                </p>
                <div className="flex gap-2 pt-1">
                  {(
                    [
                      { value: "simple", label: "Simples" },
                      { value: "grouped", label: "Agrupado" },
                      { value: "stacked", label: "Empilhado" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setStyles((s) => ({
                          ...s,
                          barGroupMode: s.barGroupMode === opt.value ? "simple" : opt.value,
                        }))
                      }
                      className={cn(
                        "flex-1 h-8 rounded-md border text-[11px] font-semibold transition-colors",
                        (styles.barGroupMode || "simple") === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-secondary text-muted-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Configuração de séries no modo agrupado/empilhado */}
            {chartType === "bar" && styles.barGroupMode && styles.barGroupMode !== "simple" && (
              <div className="space-y-1 pt-1 border-t border-border/30 mt-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  Cores por Categoria
                </span>
                <p className="text-[10px] text-muted-foreground italic">
                  Carregue as colunas na seção "Configuração das Séries" para personalizar cada
                  categoria.
                </p>
              </div>
            )}

            {/* Largura da Barra */}
            {(chartType === "bar" || chartType === "composed") && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">
                    Largura da Barra
                  </span>
                  <span className="text-[10px] font-bold text-primary">
                    {styles.barSize ? `${styles.barSize}px` : "Automático"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={6}
                    max={120}
                    step={2}
                    value={styles.barSize || 40}
                    onChange={(e) => setStyles((s) => ({ ...s, barSize: Number(e.target.value) }))}
                    className="flex-1 accent-primary"
                  />
                  {styles.barSize && (
                    <button
                      type="button"
                      onClick={() =>
                        setStyles((s) => {
                          const copy = { ...s };
                          delete copy.barSize;
                          return copy;
                        })
                      }
                      className="text-[10px] font-bold text-destructive hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Espaçamento entre Barras (Aproximar) */}
            {(chartType === "bar" || chartType === "composed") && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">
                    Espaçamento (Aproximar)
                  </span>
                  <span className="text-[10px] font-bold text-primary">
                    {styles.barCategoryGap !== undefined
                      ? `${styles.barCategoryGap}%`
                      : "Automático"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={80}
                    step={2}
                    value={styles.barCategoryGap !== undefined ? styles.barCategoryGap : 10}
                    onChange={(e) =>
                      setStyles((s) => ({ ...s, barCategoryGap: Number(e.target.value) }))
                    }
                    className="flex-1 accent-primary"
                  />
                  {styles.barCategoryGap !== undefined && (
                    <button
                      type="button"
                      onClick={() =>
                        setStyles((s) => {
                          const copy = { ...s };
                          delete copy.barCategoryGap;
                          return copy;
                        })
                      }
                      className="text-[10px] font-bold text-destructive hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Cores Título */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                Cor do Título
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[undefined, "#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#6366f1", "#a855f7"].map(
                  (c) => (
                    <button
                      key={c || "def"}
                      type="button"
                      onClick={() => setStyles((s) => ({ ...s, titleColor: c }))}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-transform",
                        styles.titleColor === c ? "border-primary scale-110" : "border-transparent",
                      )}
                      style={{ backgroundColor: c || "var(--muted-foreground)" }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        </Field>
      )}

      {/* Configuração de Séries */}
      {(chartType === "bar" ||
        chartType === "donut" ||
        chartType === "line" ||
        chartType === "composed" ||
        chartType === "table") &&
        presetId === "custom_sql" && (
          <Field
            label={chartType === "table" ? "Configuração das Colunas" : "Configuração das Séries"}
          >
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] text-muted-foreground">
                  {chartType === "table"
                    ? "Configure o nome e a visibilidade de cada coluna retornada pelo seu SQL."
                    : "Configure o nome e a cor de cada coluna retornada pelo seu SQL."}
                </p>
                <button
                  type="button"
                  onClick={loadSqlKeys}
                  disabled={loadingKeys || !connectionId || !content}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-secondary px-3 text-[11px] font-bold hover:bg-secondary/80 disabled:opacity-50"
                >
                  {loadingKeys ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Settings2 size={12} />
                  )}
                  Carregar colunas
                </button>
              </div>

              {sqlKeys.length > 0 && (
                <div className="space-y-4 pt-2">
                  {sqlKeys.map((key) => {
                    const map = styles.seriesMapping?.[key] || {};
                    return (
                      <div
                        key={key}
                        className="space-y-2 rounded-md border border-border/50 bg-secondary/10 p-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">
                            {key === ""
                              ? "(Vazio)"
                              : key === "null"
                                ? "(Nulo)"
                                : key === "undefined"
                                  ? "(Indefinido)"
                                  : key}
                          </span>
                        </div>
                        <div
                          className={
                            chartType === "table" ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"
                          }
                        >
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">
                              Nome exibido
                            </span>
                            <input
                              type="text"
                              value={map.label || ""}
                              onChange={(e) => updateSeriesMapping(key, { label: e.target.value })}
                              placeholder={key}
                              className="h-7 w-full rounded border border-border bg-card px-2 text-[11px] focus:border-primary focus:outline-none"
                            />
                          </div>
                          {chartType !== "table" && (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                Cor da barra
                              </span>
                              <div className="flex gap-1.5 pt-1">
                                {[
                                  "#10b981",
                                  "#f59e0b",
                                  "#0ea5e9",
                                  "#ef4444",
                                  "#6366f1",
                                  "#a855f7",
                                ].map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => updateSeriesMapping(key, { color: c })}
                                    className={cn(
                                      "h-5 w-5 rounded-full border-2 transition-transform",
                                      map.color === c
                                        ? "border-primary scale-110"
                                        : "border-transparent",
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 pt-1 border-t border-border/30 mt-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => updateSeriesMapping(key, { hidden: !map.hidden })}
                            className={cn(
                              "flex items-center gap-1.5 text-[10px] font-medium transition-colors",
                              map.hidden
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <div
                              className={cn(
                                "h-3 w-3 rounded-sm border",
                                map.hidden
                                  ? "bg-primary border-primary"
                                  : "border-muted-foreground",
                              )}
                            >
                              {map.hidden && <Check size={10} className="text-white" />}
                            </div>
                            {chartType === "table" ? "Ocultar coluna" : "Ocultar barra"}
                          </button>
                          {chartType !== "table" && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSeriesMapping(key, { showInFooter: !map.showInFooter })
                              }
                              className={cn(
                                "flex items-center gap-1.5 text-[10px] font-medium transition-colors",
                                map.showInFooter
                                  ? "text-primary"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-3 w-3 rounded-sm border",
                                  map.showInFooter
                                    ? "bg-primary border-primary"
                                    : "border-muted-foreground",
                                )}
                              >
                                {map.showInFooter && <Check size={10} className="text-white" />}
                              </div>
                              Exibir no rodapé
                            </button>
                          )}
                          {(chartType === "bar" ||
                            chartType === "donut" ||
                            chartType === "composed") && (
                            <button
                              type="button"
                              onClick={() => updateSeriesMapping(key, { blink: !map.blink })}
                              className={cn(
                                "flex items-center gap-1.5 text-[10px] font-medium transition-colors",
                                map.blink
                                  ? "text-destructive"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-3 w-3 rounded-sm border",
                                  map.blink
                                    ? "bg-destructive border-destructive"
                                    : "border-muted-foreground",
                                )}
                              >
                                {map.blink && <Check size={10} className="text-white" />}
                              </div>
                              ⚡ Piscar barra (alerta)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>
        )}

      <div className="rounded-lg border border-dashed border-border-soft p-3">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Pré-visualização
        </span>
        <div className="mt-2">
          {presetId === "custom_sql" && !isText ? (
            <div className="flex h-32 items-center justify-center rounded-lg bg-surface-muted text-xs text-muted-foreground text-center px-4">
              A pré-visualização de Custom SQL será exibida após a adição ao dashboard.
            </div>
          ) : (
            <WidgetRenderer
              title={title || (chartType === "divider" ? "" : "Widget")}
              presetId={presetId}
              chartType={chartType}
              suffix={presetId === "sla_compliance" ? "%" : undefined}
              content={content}
              valueScale={valueScale}
              connectionId={connectionId}
              refreshInterval={0}
              styles={styles}
            />
          )}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {saving ? (
          "Salvando..."
        ) : initialData ? (
          <>
            <Save size={14} /> Salvar alterações
          </>
        ) : (
          <>
            <Plus size={14} /> Adicionar ao dashboard
          </>
        )}
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
