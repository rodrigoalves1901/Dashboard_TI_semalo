import { useMemo, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout/legacy";
import { useNavigate } from "@tanstack/react-router";
import { Trash2, GripVertical, Type } from "lucide-react";
import { WidgetRenderer } from "./WidgetRenderer";
import { WidgetAlertDialog } from "./WidgetAlertDialog";
import { WidgetDrilldownDialog } from "./WidgetDrilldownDialog";
import { DrilldownTableSheet } from "./DrilldownTableSheet";
import type { Connection, Dashboard, Widget } from "@/lib/data";
import type { PresetId } from "@/lib/glpi-presets";
import type { AlertRule } from "@/lib/alert-rule";
import type { DrilldownConfig } from "@/lib/drilldown";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGrid = WidthProvider(GridLayout);

type LayoutItem = Layout[number];

type Pos = { x: number; y: number; w: number; h: number };

type Props = {
  widgets: Widget[];
  editable: boolean;
  onLayoutChange?: (layouts: Record<string, LayoutItem>) => void;
  onCommit?: (positions: Record<string, Pos>) => void;
  onRemove?: (id: string) => void;
  onValueScaleChange?: (id: string, scale: number) => void;
  onAlertRuleChange?: (id: string, rule: AlertRule) => void;
  onDrilldownChange?: (id: string, drilldown: DrilldownConfig) => void;
  /** Available connections — used by the drilldown editor. */
  connections?: Connection[];
  /** Available dashboards (same org) — used as drilldown destination targets. */
  dashboards?: Dashboard[];
  /** Called by SlideshowPlayer to pause autoplay while drilldown is open. */
  onDrilldownOpenChange?: (open: boolean) => void;
};

const COLS = 12;

function defaultPosition(w: Widget, i: number): LayoutItem {
  if (w.position) return { i: w.id, ...w.position, minW: 1, minH: 1 };
  if (w.chartType === "divider") return { i: w.id, x: 0, y: i * 1, w: 12, h: 1, minW: 2, minH: 1 };
  if (w.chartType === "markdown") return { i: w.id, x: 0, y: i * 3, w: 12, h: 3, minW: 3, minH: 2 };
  if (w.chartType === "metric") return { i: w.id, x: (i * 3) % 12, y: 0, w: 3, h: 2, minW: 2, minH: 2 };
  if (w.chartType === "table") return { i: w.id, x: 0, y: i * 4, w: 12, h: 5, minW: 3, minH: 3 };
  return { i: w.id, x: (i * 6) % 12, y: 100, w: 6, h: 4, minW: 3, minH: 3 };
}

export function WidgetGrid({
  widgets,
  editable,
  onLayoutChange,
  onCommit,
  onRemove,
  onValueScaleChange,
  onAlertRuleChange,
  onDrilldownChange,
  connections = [],
  dashboards = [],
  onDrilldownOpenChange,
}: Props) {
  const navigate = useNavigate();
  const [active, setActive] = useState<{
    widget: Widget;
    slice?: { name: string; value: number } | null;
  } | null>(null);

  const layout = useMemo<Layout>(
    () => widgets.map((w, i) => defaultPosition(w, i)),
    [widgets],
  );

  const handleChange = (current: Layout) => {
    if (!onLayoutChange) return;
    const map: Record<string, LayoutItem> = {};
    for (const l of current) map[l.i] = l;
    onLayoutChange(map);
  };

  const commit = (current: Layout) => {
    if (!onCommit) return;
    const map: Record<string, Pos> = {};
    for (const l of current) map[l.i] = { x: l.x, y: l.y, w: l.w, h: l.h };
    onCommit(map);
  };

  const handleDrilldown = (w: Widget, slice?: { name: string; value: number }) => {
    if (!w.drilldown) return;
    if (w.drilldown.type === "dashboard") {
      navigate({ to: "/app/dashboards/$id", params: { id: w.drilldown.dashboardId } });
      return;
    }
    setActive({ widget: w, slice: slice ?? null });
    onDrilldownOpenChange?.(true);
  };

  const closeDrilldown = () => {
    setActive(null);
    onDrilldownOpenChange?.(false);
  };

  if (widgets.length === 0) return null;

  return (
    <>
      <ResponsiveGrid
        className="layout"
        layout={layout}
        cols={COLS}
        rowHeight={80}
        margin={[16, 16]}
        isDraggable={editable}
        isResizable={editable}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        onLayoutChange={handleChange}
        onDragStop={commit}
        onResizeStop={commit}
      >
        {widgets.map((w) => {
          const interactive = !editable && !!w.drilldown && w.chartType !== "divider" && w.chartType !== "markdown";
          return (
            <div
              key={w.id}
              className={`relative overflow-hidden rounded-[14px] border border-border bg-card ${editable ? "ring-2 ring-primary/30" : ""}`}
            >
              {editable && (
                <>
                  <div
                    className="widget-drag-handle absolute left-0 right-0 top-0 z-10 flex h-8 cursor-move items-center justify-center gap-1 border-b border-border bg-secondary/80 text-xs font-medium text-muted-foreground hover:bg-secondary"
                    title="Arraste para mover"
                  >
                    <GripVertical size={14} />
                    <span>arraste</span>
                  </div>
                  <div className="absolute right-2 top-1 z-20 flex items-center gap-1">
                    {w.chartType === "metric" && onValueScaleChange && (
                      <div
                        className="flex items-center gap-0.5 rounded-md border border-border bg-card px-1 shadow-sm"
                        title="Tamanho do valor"
                      >
                        <button
                          type="button"
                          onClick={() => onValueScaleChange(w.id, Math.max(0.5, +(w.valueScale - 0.25).toFixed(2)))}
                          className="grid h-6 w-6 place-items-center rounded text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label="Diminuir tamanho do valor"
                        >
                          <Type size={11} />−
                        </button>
                        <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
                          {Math.round(w.valueScale * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onValueScaleChange(w.id, Math.min(6, +(w.valueScale + 0.25).toFixed(2)))}
                          className="grid h-6 w-6 place-items-center rounded text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
                          aria-label="Aumentar tamanho do valor"
                        >
                          <Type size={13} />+
                        </button>
                      </div>
                    )}
                    {w.chartType === "metric" && onAlertRuleChange && (
                      <WidgetAlertDialog
                        rule={w.alertRule}
                        onChange={(rule) => onAlertRuleChange(w.id, rule)}
                      />
                    )}
                    {onDrilldownChange && w.chartType !== "divider" && w.chartType !== "markdown" && (
                      <WidgetDrilldownDialog
                        config={w.drilldown}
                        defaultConnectionId={w.connectionId}
                        connections={connections}
                        dashboards={dashboards}
                        onChange={(cfg) => onDrilldownChange(w.id, cfg)}
                      />
                    )}
                    {onRemove && (
                      <button
                        onClick={() => onRemove(w.id)}
                        aria-label="Remover widget"
                        className="grid h-6 w-6 place-items-center rounded-md bg-card text-destructive shadow-sm hover:bg-destructive/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </>
              )}
              <div className={`h-full w-full overflow-hidden ${editable ? "pt-8" : ""}`}>
                <WidgetRenderer
                  title={w.title}
                  presetId={w.preset as PresetId}
                  chartType={w.chartType}
                  suffix={w.preset === "sla_compliance" ? "%" : undefined}
                  content={w.content}
                  valueScale={w.valueScale}
                  alertRule={w.alertRule}
                  bare
                  onDrilldown={interactive ? (slice) => handleDrilldown(w, slice) : undefined}
                />
              </div>
            </div>
          );
        })}
      </ResponsiveGrid>

      {active && active.widget.drilldown?.type === "table" && (
        <DrilldownTableSheet
          open={!!active}
          onOpenChange={(o) => !o && closeDrilldown()}
          widgetTitle={active.widget.title}
          presetId={active.widget.preset}
          config={active.widget.drilldown}
          slice={active.slice}
        />
      )}
    </>
  );
}
