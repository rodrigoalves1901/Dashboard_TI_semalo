import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
  ComposedChart,
  ReferenceLine,
  type BarShapeProps,
} from "recharts";
import { mockData, type PresetId } from "@/lib/glpi-presets";
import { MetricCard } from "./MetricCard";
import { cn } from "@/lib/utils";
import type { ChartType, WidgetStyles } from "@/lib/data";
import { evaluateAlert, type AlertRule } from "@/lib/alert-rule";
import { runExplorerQuery } from "@/lib/explorer.functions";

import { Rectangle } from "recharts";

function BlinkingBar(props: any) {
  const { blink, className, radius, ...rest } = props;

  // Compute border-radius from recharts radius prop (top-left, top-right)
  const r = Array.isArray(radius) ? radius[0] : (radius ?? 0);
  const rx = Math.min(r, (rest.width || 0) / 2, (rest.height || 0) / 2);

  return (
    <Rectangle
      {...rest}
      radius={[rx, rx, 0, 0]}
      className={cn(className, blink ? "alert-blink" : undefined)}
    />
  );
}

function abbreviateName(name: string): string {
  if (!name) return "";

  // Evita abreviar nomes de licenças conhecidas ou strings curtas para manter fidelidade no gráfico
  const lower = name.toLowerCase();
  if (
    lower.includes("power bi") ||
    lower.includes("office 365") ||
    lower.includes("microsoft 365") ||
    lower.includes("teams") ||
    lower.includes("business") ||
    lower.includes("essential") ||
    lower.includes("pago") ||
    name.length <= 15
  ) {
    return name;
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;

  const first = parts[0];
  const last = parts[parts.length - 1];
  const preps = ["de", "da", "do", "dos", "das"];

  if (parts.length >= 3) {
    const secondToLast = parts[parts.length - 2].toLowerCase();
    if (preps.includes(secondToLast)) {
      return `${first} ${parts[parts.length - 2]} ${last}`;
    }
  }

  return `${first} ${last}`;
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "var(--shadow-popover)",
};

type Props = {
  title: string;
  presetId: PresetId;
  chartType: ChartType;
  suffix?: string;
  bare?: boolean;
  content?: string | null;
  valueScale?: number;
  alertRule?: AlertRule;
  connectionId?: string | null;
  refreshInterval?: number;
  styles?: WidgetStyles;
  /** When set, the widget is interactive — fires on click (or chart slice click). */
  onDrilldown?: (slice?: { name: string; value: number }) => void;
};

interface UnifiedWidgetData {
  value?: number;
  delta?: number;
  deltaValue?: number;
  footerData?: Record<string, unknown>;
  series?: Record<string, unknown>[];
  /** Unique series keys produced by pivot grouping (grouped/stacked bar) */
  groupKeys?: string[];
  timeSeries?: {
    date: string;
    opened: number;
    solved: number;
  }[];
  rows?: Record<string, string | number>[];
}

export function WidgetRenderer({
  title,
  presetId,
  chartType,
  suffix,
  bare,
  content,
  valueScale,
  alertRule,
  connectionId,
  refreshInterval,
  styles = {},
  onDrilldown,
}: Props) {
  const clickable = !!onDrilldown;
  const handleCardClick = () => onDrilldown?.();

  const [rawData, setRawData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mock = useMemo(() => (presetId === "custom_sql" ? null : mockData(presetId)), [presetId]);

  const dynamicData = useMemo(() => {
    if (!rawData) return null;
    const res = rawData;
    const transformed: {
      footerData?: Record<string, unknown>;
      value?: number;
      delta?: number;
      deltaValue?: number;
      series?: Record<string, unknown>[];
      groupKeys?: string[];
      timeSeries?: {
        date: string;
        opened: number;
        solved: number;
      }[];
    } = {};
    const footerKeys = [
      "diferenca",
      "diferença",
      "percentual_variacao",
      "variacao",
      "variacao_percentual",
      "percentual",
    ];

    // Extração global de dados de rodapé/comparação (para métricas e gráficos)
    if (res && res.length > 0) {
      const footerData: Record<string, unknown> = {};

      if (res.length === 1) {
        Object.entries(res[0] as Record<string, unknown>).forEach(([k, v]) => {
          const mapping = styles.seriesMapping?.[k];
          if (mapping?.showInFooter || footerKeys.includes(k.toLowerCase())) {
            const label =
              mapping?.label || k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
            footerData[label] = v;
            footerData[`_orig_${k.toLowerCase()}`] = v;
          }
        });
      } else {
        // Múltiplos registros - associa cada valor de rodapé ao nome da categoria
        res.forEach((row) => {
          const rowVals = Object.values(row);
          if (rowVals.length === 0) return;
          const categoryName = String(rowVals[0]);

          Object.entries(row as Record<string, unknown>).forEach(([k, v]) => {
            const mapping = styles.seriesMapping?.[k];
            if (mapping?.showInFooter || footerKeys.includes(k.toLowerCase())) {
              const baseLabel =
                mapping?.label || k.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
              const label = `${baseLabel} (${categoryName})`;
              footerData[label] = v;
              if (footerData[`_orig_${k.toLowerCase()}`] === undefined) {
                footerData[`_orig_${k.toLowerCase()}`] = v;
              }
            }
          });
        });
      }

      if (Object.keys(footerData).length > 0) {
        transformed.footerData = footerData;
      }
    }

    if (chartType === "metric") {
      // Pega o primeiro valor que não é de rodapé, ou o primeiro valor absoluto se todos falharem
      const firstNonFooterVal = res[0]
        ? Object.entries(res[0]).find(([k]) => {
            const mapping = styles.seriesMapping?.[k];
            return !(mapping?.showInFooter || footerKeys.includes(k.toLowerCase()));
          })?.[1]
        : 0;

      transformed.value =
        firstNonFooterVal !== undefined
          ? Number(firstNonFooterVal)
          : res[0]
            ? Number(Object.values(res[0])[0])
            : 0;

      // Se houver dados de comparação, injeta delta
      if (transformed.footerData) {
        const deltaPct =
          transformed.footerData["_orig_percentual_variacao"] ||
          transformed.footerData["_orig_variacao"] ||
          transformed.footerData["_orig_percentual"];
        const deltaVal =
          transformed.footerData["_orig_diferenca"] || transformed.footerData["_orig_diferença"];
        if (deltaPct !== undefined) transformed.delta = Number(deltaPct);
        if (deltaVal !== undefined) transformed.deltaValue = Number(deltaVal);
      }
    } else if (chartType === "donut" || chartType === "bar") {
      if (res.length === 1 && Object.keys(res[0]).length > 1) {
        // Caso especial: Uma única linha com várias colunas (Ex: SELECT count(a), count(b)...)
        transformed.series = Object.entries(res[0])
          .filter(([key]) => {
            const mapping = styles.seriesMapping?.[key];
            if (mapping?.hidden) return false;
            if (footerKeys.includes(key.toLowerCase()) && !mapping) return false;
            return true;
          })
          .map(([key, val]) => {
            const mapping = styles.seriesMapping?.[key];
            return {
              name:
                mapping?.label || key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
              value: Number(val ?? 0),
              originalKey: key,
            };
          });
      } else if (
        chartType === "bar" &&
        styles.barGroupMode &&
        styles.barGroupMode !== "simple" &&
        res.length > 0 &&
        Object.keys(res[0]).length >= 3
      ) {
        // Modo pivot: col1 = eixo X, col2 = série (agrupador), col3 = valor
        const keys = Object.keys(res[0]);
        const xKey = keys[0];
        const groupKey = keys[1];
        const valueKey = keys[2];

        // Coleta todos os grupos únicos (col2) preservando ordem
        const allGroups = Array.from(
          new Set(res.map((r) => String((r as Record<string, unknown>)[groupKey] ?? ""))),
        );

        // Monta pivot: { [xValue]: { [groupValue]: number } }
        const pivotMap: Map<string, Record<string, number>> = new Map();
        for (const r of res) {
          const row = r as Record<string, unknown>;
          const xVal = String(row[xKey] ?? "");
          const gVal = String(row[groupKey] ?? "");
          const numVal = Number(row[valueKey] ?? 0);
          if (!pivotMap.has(xVal)) pivotMap.set(xVal, {});
          pivotMap.get(xVal)![gVal] = numVal;
        }

        transformed.series = Array.from(pivotMap.entries()).map(([xVal, vals]) => {
          const item: Record<string, unknown> = { name: xVal };
          for (const g of allGroups) item[g] = vals[g] ?? 0;
          return item;
        });
        transformed.groupKeys = allGroups;
      } else {
        // Caso padrão: Múltiplas linhas
        transformed.series = res
          .filter((r) => {
            const name = String(Object.values(r)[0]);
            return !styles.seriesMapping?.[name]?.hidden;
          })
          .map((r) => {
            const vals = Object.values(r);
            const name = String(vals[0]);
            const mapping = styles.seriesMapping?.[name];
            return {
              name: mapping?.label || abbreviateName(name),
              value: Number(vals[1] ?? 0),
              originalKey: name,
            };
          });
      }
    } else if (chartType === "line") {
      transformed.timeSeries = res.map((r) => {
        const vals = Object.values(r);
        return {
          date: String(vals[0]),
          opened: Number(vals[1] ?? 0),
          solved: Number(vals[2] ?? 0),
        };
      });
    } else if (chartType === "table") {
      transformed.series = res;
    } else if (chartType === "composed") {
      transformed.series = res
        .filter((r) => {
          const name = String(Object.values(r)[0]);
          return !styles.seriesMapping?.[name]?.hidden;
        })
        .map((r) => {
          const keys = Object.keys(r);
          const vals = Object.values(r);
          const name = String(vals[0]);
          const mapping = styles.seriesMapping?.[name];

          const item: Record<string, unknown> = {
            name: mapping?.label || abbreviateName(name),
            originalKey: name,
          };

          for (let i = 1; i < keys.length; i++) {
            item[keys[i]] = Number(vals[i] ?? 0);
          }
          return item;
        });
    }

    return transformed;
  }, [rawData, styles, chartType]);

  const isPercentageZeroToOne = useMemo(() => {
    const series = dynamicData?.series;
    if (!series || series.length === 0) return false;
    const pctKeys = Object.keys(series[0]).filter(
      (k) =>
        k.toLowerCase().includes("percentual") ||
        k.toLowerCase().includes("pct") ||
        k.toLowerCase().includes("porcentagem") ||
        k.toLowerCase().includes("taxa") ||
        k.toLowerCase().includes("percent"),
    );
    if (pctKeys.length === 0) return false;
    return (series as Record<string, unknown>[]).every((item) => {
      const val = Number(item[pctKeys[0]] ?? 0);
      return val >= 0 && val <= 1;
    });
  }, [dynamicData]);

  useEffect(() => {
    if (presetId !== "custom_sql" || !connectionId || !content) return;

    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      try {
        const res = await runExplorerQuery({ data: { connectionId, query: content } });
        if (cancelled) return;
        setRawData(res);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetch();
    let interval: ReturnType<typeof setInterval>;
    if (refreshInterval && refreshInterval > 0) {
      interval = setInterval(fetch, refreshInterval * 1000);
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [presetId, connectionId, content, refreshInterval]);

  if (chartType === "divider") {
    return (
      <div className="flex h-full w-full items-center gap-3 px-2">
        <div className="h-px flex-1 bg-border" />
        {title && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        )}
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  if (chartType === "markdown") {
    return (
      <div
        className={
          bare
            ? "h-full overflow-auto p-5 flex flex-col relative"
            : "rounded-[14px] border border-border bg-card p-5 shadow-card flex flex-col relative"
        }
      >
        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-img:rounded-lg prose-img:my-3 prose-img:max-h-64 prose-img:w-auto dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ""}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const data = (presetId === "custom_sql" ? dynamicData || {} : mock || {}) as UnifiedWidgetData;
  const shellClass = bare
    ? "h-full p-5 flex flex-col relative"
    : "rounded-[14px] border border-border bg-card p-5 shadow-card flex flex-col relative";

  if (error) {
    return (
      <div className={shellClass + " items-center justify-center text-center space-y-2"}>
        <AlertCircle size={24} className="text-destructive opacity-80" />
        <p className="text-xs font-semibold text-destructive">{error}</p>
      </div>
    );
  }

  if (presetId === "custom_sql" && loading && !dynamicData) {
    return (
      <div className={shellClass + " items-center justify-center text-center space-y-2"}>
        <Loader2 size={24} className="text-muted-foreground animate-spin opacity-50" />
        <p className="text-xs text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  if (chartType === "metric" && data.value !== undefined) {
    const level = evaluateAlert(data.value, alertRule ?? null);
    const card = (
      <MetricCard
        label={title}
        value={data.value}
        delta={data.delta}
        deltaValue={data.deltaValue}
        suffix={suffix}
        bare={bare}
        valueScale={valueScale}
        alertLevel={level}
        alertBlink={!!alertRule?.blink}
        styles={styles}
      />
    );
    if (!clickable) return card;
    return (
      <button
        type="button"
        onClick={handleCardClick}
        className="group block h-full w-full text-left transition-transform hover:scale-[1.005] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        title="Clique para ver detalhes"
      >
        {card}
      </button>
    );
  }

  if (chartType === "table" && data.series) {
    const columns = data.series.length > 0 ? Object.keys(data.series[0]) : [];
    const visibleColumns = columns.filter((col) => !styles.seriesMapping?.[col]?.hidden);

    const getColumnLabel = (col: string) => {
      const mapping = styles.seriesMapping?.[col];
      if (mapping?.label) return mapping.label;
      if (col === "name") return "Item";
      if (col === "value") return "Valor";
      return col.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const isColNumeric = (col: string) => {
      const series = data.series;
      if (!series || series.length === 0) return false;
      const val = (series[0] as Record<string, unknown>)[col];
      return typeof val === "number";
    };

    const handleRowClick = (r: Record<string, unknown>) => {
      if (!clickable) return;
      const firstKey = visibleColumns[0] || "";
      const secondKey = visibleColumns[1] || "";
      const rawVal = r[secondKey];
      const numVal = typeof rawVal === "number" ? rawVal : Number(rawVal);
      onDrilldown?.({
        name: String(r[firstKey] ?? ""),
        value: isNaN(numVal) ? 0 : numVal,
      });
    };

    return (
      <div className={shellClass}>
        <div
          className={cn(
            "mb-4 flex items-center justify-between gap-2",
            styles.centerTitle ? "flex-col text-center" : "",
          )}
        >
          <h3
            className="font-bold text-foreground"
            style={{
              fontSize: `${15 * (styles.titleSize ?? 1)}px`,
              fontWeight: styles.titleBold ? "bold" : undefined,
              color: styles.titleColor || undefined,
              textAlign: styles.centerTitle ? "center" : undefined,
              width: styles.centerTitle ? "100%" : undefined,
            }}
          >
            {title}
          </h3>
          {loading && (
            <Loader2 size={12} className="animate-spin text-muted-foreground opacity-50" />
          )}
        </div>
        <div
          className={cn("overflow-auto scrollbar-thin w-full", bare ? "flex-1 min-h-0" : "h-64")}
        >
          <table className="w-full min-w-max text-sm table-auto">
            <thead className="sticky top-0 bg-surface-muted text-xs font-semibold text-muted-foreground z-10">
              <tr>
                {visibleColumns.length > 0 ? (
                  visibleColumns.map((col) => (
                    <th
                      key={col}
                      className={cn(
                        "px-3 py-2 text-muted-foreground bg-surface-muted",
                        isColNumeric(col) ? "text-right" : "text-left",
                      )}
                    >
                      {getColumnLabel(col)}
                    </th>
                  ))
                ) : (
                  <th className="px-3 py-2 text-left">Nenhum dado retornado</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(data.series as Record<string, unknown>[]).length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, visibleColumns.length)}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    Nenhum dado retornado para esta consulta.
                  </td>
                </tr>
              ) : (
                (data.series as Record<string, unknown>[]).map((r, idx) => {
                  const keyVal = r.id || r.name || idx;
                  return (
                    <tr
                      key={String(keyVal)}
                      onClick={clickable ? () => handleRowClick(r) : undefined}
                      className={cn(
                        "border-t border-border-soft",
                        clickable ? "cursor-pointer hover:bg-secondary/60" : "",
                      )}
                    >
                      {visibleColumns.map((col) => {
                        const val = r[col];
                        const isNumeric = isColNumeric(col);
                        return (
                          <td
                            key={col}
                            className={cn(
                              "px-3 py-2 text-foreground",
                              isNumeric ? "text-right font-semibold" : "text-left",
                            )}
                          >
                            {val !== null && val !== undefined ? String(val) : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div
        className={cn(
          "mb-4 flex items-center justify-between gap-2",
          styles.centerTitle ? "flex-col text-center" : "",
        )}
      >
        <h3
          className="font-bold text-foreground"
          style={{
            fontSize: `${15 * (styles.titleSize ?? 1)}px`,
            fontWeight: styles.titleBold ? "bold" : undefined,
            color: styles.titleColor || undefined,
            textAlign: styles.centerTitle ? "center" : undefined,
            width: styles.centerTitle ? "100%" : undefined,
          }}
        >
          {title}
        </h3>
        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground opacity-50" />}
      </div>
      <div className={bare ? "flex-1 min-h-0" : "h-64"}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" && data.series ? (
            <BarChart
              data={data.series}
              margin={{ top: 16, right: 8, left: -16, bottom: styles.rotateLabels ? 25 : 0 }}
              barCategoryGap={
                styles.barCategoryGap !== undefined ? `${styles.barCategoryGap}%` : undefined
              }
              stackOffset={styles.barGroupMode === "stacked" ? "none" : undefined}
            >
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                angle={styles.rotateLabels ? -35 : undefined}
                textAnchor={styles.rotateLabels ? "end" : undefined}
                height={styles.rotateLabels ? 55 : undefined}
                interval={styles.rotateLabels ? 0 : undefined}
                padding={
                  styles.barCategoryGap !== undefined
                    ? {
                        left: (80 - styles.barCategoryGap) * 2.2,
                        right: (80 - styles.barCategoryGap) * 2.2,
                      }
                    : undefined
                }
              />
              <YAxis
                domain={[
                  (dataMin: number) => (dataMin < 0 ? Math.floor(dataMin * 1.15) : 0),
                  (dataMax: number) => Math.ceil(dataMax * 1.15 || 10),
                ]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
              {data.groupKeys && data.groupKeys.length > 0 && (
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              )}
              {data.series.some((d: any) => Number(d.value) < 0) && (
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              )}
              {data.groupKeys && data.groupKeys.length > 0
                ? // Modo agrupado/empilhado: múltiplas barras via pivot
                  data.groupKeys.map((gk, gIdx) => {
                    const mapping = styles.seriesMapping?.[gk];
                    if (mapping?.hidden) return null;
                    const fillColor = mapping?.color || CHART_COLORS[gIdx % CHART_COLORS.length];
                    const displayName =
                      mapping?.label || (gk === "" ? "(Vazio)" : gk === "null" ? "(Nulo)" : gk);
                    return (
                      <Bar
                        key={gk}
                        dataKey={gk}
                        name={displayName}
                        fill={fillColor}
                        radius={styles.barGroupMode === "stacked" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                        barSize={styles.barSize}
                        stackId={styles.barGroupMode === "stacked" ? "stack" : undefined}
                        isAnimationActive={!styles.disableAnimations}
                      >
                        {styles.showValues && (
                          <LabelList
                            dataKey={gk}
                            position={styles.barGroupMode === "stacked" ? "inside" : "top"}
                            style={{
                              fill:
                                styles.barGroupMode === "stacked" ? "#fff" : "var(--foreground)",
                              fontSize: 10,
                              fontWeight: "bold",
                            }}
                          />
                        )}
                      </Bar>
                    );
                  })
                : // Modo simples: barra única por linha
                  [
                    <Bar
                      key="single"
                      dataKey="value"
                      radius={[4, 4, 0, 0]}
                      barSize={styles.barSize}
                      isAnimationActive={!styles.disableAnimations}
                      cursor={clickable ? "pointer" : undefined}
                      onClick={
                        clickable
                          ? (d) => {
                              const payload = d as { name?: string; value?: number };
                              onDrilldown?.({
                                name: String(payload?.name ?? ""),
                                value: Number(payload?.value ?? 0),
                              });
                            }
                          : undefined
                      }
                      shape={(shapeProps: BarShapeProps) => {
                        const entry = shapeProps.payload as Record<string, unknown> | undefined;
                        const originalKey = entry?.originalKey as string | undefined;
                        const mapping = originalKey
                          ? styles.seriesMapping?.[originalKey]
                          : undefined;
                        const idx = shapeProps.index ?? 0;
                        const val = Number(shapeProps.value ?? entry?.value ?? 0);
                        const defaultColor =
                          val < 0 ? "var(--destructive)" : CHART_COLORS[idx % CHART_COLORS.length];
                        const fillColor = mapping?.color || defaultColor;
                        return (
                          <BlinkingBar
                            x={shapeProps.x ?? 0}
                            y={shapeProps.y ?? 0}
                            width={shapeProps.width ?? 0}
                            height={shapeProps.height ?? 0}
                            fill={fillColor}
                            blink={mapping?.blink}
                            radius={[4, 4, 0, 0]}
                          />
                        );
                      }}
                    >
                      {styles.showValues && (
                        <LabelList
                          dataKey="value"
                          position="top"
                          style={{
                            fill: "var(--foreground)",
                            fontSize: 11,
                            fontWeight: "bold",
                          }}
                        />
                      )}
                    </Bar>,
                  ]}
            </BarChart>
          ) : chartType === "line" && data.timeSeries ? (
            <LineChart
              data={data.timeSeries}
              margin={{ top: 8, right: 8, left: -16, bottom: styles.rotateLabels ? 25 : 0 }}
            >
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                angle={styles.rotateLabels ? -35 : undefined}
                textAnchor={styles.rotateLabels ? "end" : undefined}
                height={styles.rotateLabels ? 55 : undefined}
                interval={styles.rotateLabels ? 0 : undefined}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="opened"
                name="Abertos"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!styles.disableAnimations}
              />
              <Line
                type="monotone"
                dataKey="solved"
                name="Resolvidos"
                stroke="var(--chart-6)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!styles.disableAnimations}
              />
            </LineChart>
          ) : chartType === "donut" && data.series ? (
            <PieChart>
              <Pie
                data={data.series}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={!styles.disableAnimations}
                label={
                  styles.showValues
                    ? (entry: unknown) => {
                        const e = entry as { name: string; value: number };
                        return `${e.name}: ${e.value}`;
                      }
                    : false
                }
                labelLine={
                  styles.showValues ? { stroke: "var(--muted-foreground)", strokeWidth: 1 } : false
                }
                cursor={clickable ? "pointer" : undefined}
                onClick={
                  clickable
                    ? (d) => {
                        const payload = d as { name?: string; value?: number };
                        onDrilldown?.({
                          name: String(payload?.name ?? ""),
                          value: Number(payload?.value ?? 0),
                        });
                      }
                    : undefined
                }
              >
                {(data.series as Record<string, unknown>[]).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          ) : chartType === "composed" && data.series ? (
            <ComposedChart
              data={data.series}
              margin={{ top: 16, right: -8, left: -16, bottom: 20 }}
              barCategoryGap={
                styles.barCategoryGap !== undefined ? `${styles.barCategoryGap}%` : undefined
              }
            >
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                angle={styles.rotateLabels ? -35 : -30}
                textAnchor="end"
                height={55}
                interval={styles.rotateLabels ? 0 : undefined}
                padding={
                  styles.barCategoryGap !== undefined
                    ? {
                        left: (80 - styles.barCategoryGap) * 1.5,
                        right: (80 - styles.barCategoryGap) * 1.5,
                      }
                    : undefined
                }
              />
              <YAxis
                yAxisId="left"
                domain={[
                  (dataMin: number) => (dataMin < 0 ? Math.floor(dataMin * 1.35) : 0),
                  (dataMax: number) => Math.ceil(dataMax * 1.35 || 10),
                ]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[
                  (dataMin: number) => (dataMin < 0 ? Math.floor(dataMin * 1.1) : 0),
                  isPercentageZeroToOne
                    ? 1.1
                    : (dataMax: number) => Math.ceil(dataMax * 1.1 || 110),
                ]}
                tickFormatter={(v) => (isPercentageZeroToOne ? `${Math.round(v * 100)}%` : `${v}%`)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {data.series.some((d: any) =>
                Object.values(d).some((v) => typeof v === "number" && v < 0),
              ) && (
                <ReferenceLine y={0} yAxisId="left" stroke="var(--border)" strokeDasharray="3 3" />
              )}

              {/* Renderiza as barras */}
              {(() => {
                const keys =
                  data.series && data.series.length > 0
                    ? Object.keys(data.series[0]).filter((k) => k !== "name" && k !== "originalKey")
                    : [];
                const lineKeys = keys.filter(
                  (k) =>
                    k.toLowerCase().includes("percentual") ||
                    k.toLowerCase().includes("pct") ||
                    k.toLowerCase().includes("porcentagem") ||
                    k.toLowerCase().includes("taxa") ||
                    k.toLowerCase().includes("percent"),
                );
                const barKeys = keys.filter((k) => !lineKeys.includes(k));

                return barKeys.map((barKey, index) => {
                  const mapping = styles.seriesMapping?.[barKey];
                  return (
                    <Bar
                      key={barKey}
                      yAxisId="left"
                      dataKey={barKey}
                      name={
                        mapping?.label ||
                        barKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
                      }
                      barSize={styles.barSize}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!styles.disableAnimations}
                    >
                      {(data.series as Record<string, unknown>[]).map((entry, cellIndex) => {
                        const keys = Object.keys(entry);
                        let totalVal = 0;
                        let assignedVal = 0;

                        keys.forEach((k) => {
                          const kLower = k.toLowerCase();
                          if (
                            kLower.includes("total") ||
                            kLower.includes("dispon") ||
                            kLower.includes("capac")
                          ) {
                            totalVal = Number(entry[k] ?? 0);
                          }
                          if (
                            kLower.includes("assign") ||
                            kLower.includes("utili") ||
                            kLower.includes("usad") ||
                            kLower.includes("consum")
                          ) {
                            assignedVal = Number(entry[k] ?? 0);
                          }
                        });

                        const isDeficit = totalVal > 0 && assignedVal > totalVal;
                        const isUtilizadas =
                          barKey.toLowerCase().includes("assign") ||
                          barKey.toLowerCase().includes("utili") ||
                          barKey.toLowerCase().includes("usad") ||
                          barKey.toLowerCase().includes("consum");

                        const cellColor =
                          isDeficit && isUtilizadas
                            ? "#ef4444"
                            : mapping?.color ||
                              CHART_COLORS[index % CHART_COLORS.length] ||
                              "#0d9488";

                        return (
                          <Cell
                            key={`cell-${cellIndex}`}
                            fill={cellColor}
                            className={isDeficit && isUtilizadas ? "alert-blink" : ""}
                          />
                        );
                      })}
                      {styles.showValues && (
                        <LabelList
                          dataKey={barKey}
                          position="top"
                          style={{ fill: "var(--foreground)", fontSize: 10, fontWeight: "bold" }}
                        />
                      )}
                    </Bar>
                  );
                });
              })()}

              {/* Renderiza as linhas */}
              {(() => {
                const keys =
                  data.series && data.series.length > 0
                    ? Object.keys(data.series[0]).filter((k) => k !== "name" && k !== "originalKey")
                    : [];
                const lineKeys = keys.filter(
                  (k) =>
                    k.toLowerCase().includes("percentual") ||
                    k.toLowerCase().includes("pct") ||
                    k.toLowerCase().includes("porcentagem") ||
                    k.toLowerCase().includes("taxa") ||
                    k.toLowerCase().includes("percent"),
                );

                return lineKeys.map((lineKey) => {
                  const mapping = styles.seriesMapping?.[lineKey];
                  return (
                    <Line
                      key={lineKey}
                      yAxisId="right"
                      type="monotone"
                      dataKey={lineKey}
                      name={
                        mapping?.label ||
                        lineKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
                      }
                      stroke={mapping?.color || "#f59e0b"}
                      strokeWidth={3}
                      dot={{ fill: mapping?.color || "#f59e0b", r: 4, strokeWidth: 1 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={!styles.disableAnimations}
                    >
                      {styles.showValues && (
                        <LabelList
                          dataKey={lineKey}
                          position="top"
                          offset={10}
                          formatter={(v) => {
                            const num = Number(v);
                            return isPercentageZeroToOne ? `${Math.round(num * 100)}%` : `${num}%`;
                          }}
                          style={{
                            fill: mapping?.color || "#f59e0b",
                            fontSize: 9,
                            fontWeight: "bold",
                          }}
                        />
                      )}
                    </Line>
                  );
                });
              })()}
            </ComposedChart>
          ) : (
            <BarChart data={[]}>
              <XAxis hide />
              <YAxis hide />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Rodapé de Informações Adicionais (Estatísticas) */}
      {data.footerData && Object.keys(data.footerData).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 border-t border-border/50 pt-3">
          {Object.entries(data.footerData)
            .filter(([key]) => !key.startsWith("_orig_"))
            .map(([key, val]: [string, unknown]) => {
              const isPct = key.includes("percentual") || key.includes("variacao");
              const isDiff = key.includes("diferenca") || key.includes("diferença");
              const numVal = Number(val);
              const positive = numVal >= 0;

              return (
                <div key={key} className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </span>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-bold",
                      isPct || isDiff
                        ? positive
                          ? "text-success"
                          : "text-destructive"
                        : "text-foreground",
                    )}
                  >
                    {(isPct || isDiff) &&
                      (positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
                    {typeof val === "number"
                      ? isPct
                        ? `${val.toFixed(2)}%`
                        : val.toLocaleString()
                      : String(val ?? "")}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
