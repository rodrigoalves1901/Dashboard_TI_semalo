import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
} from "recharts";
import { mockData, type PresetId } from "@/lib/glpi-presets";
import { MetricCard } from "./MetricCard";
import type { ChartType } from "@/lib/data";
import { evaluateAlert, type AlertRule } from "@/lib/alert-rule";

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
};

export function WidgetRenderer({ title, presetId, chartType, suffix, bare, content, valueScale, alertRule }: Props) {
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
      <div className={bare ? "h-full overflow-auto p-5" : "rounded-[14px] border border-border bg-card p-5 shadow-card"}>
        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary prose-img:rounded-lg prose-img:my-3 prose-img:max-h-64 prose-img:w-auto dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content ?? ""}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const data = useMemo(() => mockData(presetId), [presetId]);
  const shellClass = bare
    ? "h-full p-5"
    : "rounded-[14px] border border-border bg-card p-5 shadow-card";

  if (chartType === "metric" && data.value !== undefined) {
    const level = evaluateAlert(data.value, alertRule ?? null);
    return (
      <MetricCard
        label={title}
        value={data.value}
        delta={data.delta}
        suffix={suffix}
        bare={bare}
        valueScale={valueScale}
        alertLevel={level}
        alertBlink={!!alertRule?.blink}
      />
    );
  }

  if (chartType === "table" && data.series) {
    return (
      <div className={shellClass}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
        </div>
        <div className="h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-muted text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map((r) => (
                <tr key={r.name} className="border-t border-border-soft">
                  <td className="px-3 py-2 text-foreground">{r.name}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
      </div>
      <div className={bare ? "h-[calc(100%-2.5rem)]" : "h-64"}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" && data.series ? (
            <BarChart data={data.series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-1)" />
            </BarChart>
          ) : chartType === "line" && data.timeSeries ? (
            <LineChart data={data.timeSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-soft)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="opened" name="Abertos" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="solved" name="Resolvidos" stroke="var(--chart-6)" strokeWidth={2} dot={false} />
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
              >
                {data.series.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          ) : (
            <BarChart data={[]}>
              <XAxis hide />
              <YAxis hide />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
