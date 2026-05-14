import { useMemo } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout/legacy";
import { Trash2, GripVertical } from "lucide-react";
import { WidgetRenderer } from "./WidgetRenderer";
import type { Widget } from "@/lib/data";
import type { PresetId } from "@/lib/glpi-presets";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGrid = WidthProvider(GridLayout);

type LayoutItem = Layout[number];

type Props = {
  widgets: Widget[];
  editable: boolean;
  onLayoutChange?: (layouts: Record<string, LayoutItem>) => void;
  onCommit?: (id: string, position: { x: number; y: number; w: number; h: number }) => void;
  onRemove?: (id: string) => void;
};

const COLS = 12;

function defaultPosition(w: Widget, i: number): LayoutItem {
  if (w.position) return { i: w.id, ...w.position, minW: 2, minH: 2 };
  if (w.chartType === "metric") return { i: w.id, x: (i * 3) % 12, y: 0, w: 3, h: 2, minW: 2, minH: 2 };
  if (w.chartType === "table") return { i: w.id, x: 0, y: i * 4, w: 12, h: 5, minW: 3, minH: 3 };
  return { i: w.id, x: (i * 6) % 12, y: 100, w: 6, h: 4, minW: 3, minH: 3 };
}

export function WidgetGrid({ widgets, editable, onLayoutChange, onCommit, onRemove }: Props) {
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

  // Fired only when the user releases the mouse — perfect moment to persist.
  const commit = (_l: Layout, _old: LayoutItem | null, item: LayoutItem | null) => {
    if (!item) return;
    onCommit?.(item.i, { x: item.x, y: item.y, w: item.w, h: item.h });
  };

  if (widgets.length === 0) return null;

  return (
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
      {widgets.map((w) => (
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
              {onRemove && (
                <button
                  onClick={() => onRemove(w.id)}
                  aria-label="Remover widget"
                  className="absolute right-2 top-1 z-20 grid h-6 w-6 place-items-center rounded-md bg-card text-destructive shadow-sm hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </>
          )}
          <div className={`h-full w-full overflow-hidden ${editable ? "pt-8" : ""}`}>
            <WidgetRenderer
              title={w.title}
              presetId={w.preset as PresetId}
              chartType={w.chartType}
              suffix={w.preset === "sla_compliance" ? "%" : undefined}
            />
          </div>
        </div>
      ))}
    </ResponsiveGrid>
  );
}
