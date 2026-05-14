import { useEffect, useMemo, useRef, useState } from "react";
import RGL, { Responsive, WidthProvider, type Layout as LayoutItem } from "react-grid-layout";
import { Trash2 } from "lucide-react";
import { WidgetRenderer } from "./WidgetRenderer";
import type { Widget } from "@/lib/data";
import type { PresetId } from "@/lib/glpi-presets";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// `Responsive` is exported as a named member on this build of react-grid-layout;
// `WidthProvider` lives on the default export.
const RP = (RGL as any).Responsive ?? Responsive;
const WP = (RGL as any).WidthProvider ?? WidthProvider;
const ResponsiveGridLayout = WP(RP);

type Props = {
  widgets: Widget[];
  editable: boolean;
  onLayoutChange?: (layouts: Record<string, LayoutItem>) => void;
  onRemove?: (id: string) => void;
};

const COLS = { lg: 12, md: 8, sm: 4, xs: 2, xxs: 2 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };

function defaultPosition(w: Widget, i: number): Layout {
  const base = { i: w.id, minW: 2, minH: 2 };
  if (w.position) return { ...base, ...w.position };
  if (w.chartType === "metric") return { ...base, x: (i * 3) % 12, y: 0, w: 3, h: 2 };
  if (w.chartType === "table") return { ...base, x: 0, y: i * 4, w: 12, h: 4 };
  return { ...base, x: (i * 6) % 12, y: 100, w: 6, h: 4 };
}

export function WidgetGrid({ widgets, editable, onLayoutChange, onRemove }: Props) {
  const layout = useMemo<Layout[]>(
    () => widgets.map((w, i) => defaultPosition(w, i)),
    [widgets],
  );

  // Debounced persist
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, force] = useState(0);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleChange = (current: Layout[]) => {
    if (!onLayoutChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const map: Record<string, Layout> = {};
      for (const l of current) map[l.i] = l;
      onLayoutChange(map);
      force((n) => n + 1);
    }, 400);
  };

  if (widgets.length === 0) return null;

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout, md: layout, sm: layout }}
      cols={COLS}
      breakpoints={BREAKPOINTS}
      rowHeight={80}
      margin={[16, 16]}
      isDraggable={editable}
      isResizable={editable}
      draggableCancel=".no-drag"
      onLayoutChange={handleChange}
    >
      {widgets.map((w) => (
        <div key={w.id} className="relative">
          {editable && onRemove && (
            <button
              onClick={() => onRemove(w.id)}
              aria-label="Remover widget"
              className="no-drag absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md bg-card/80 text-destructive shadow-sm hover:bg-destructive/10"
            >
              <Trash2 size={13} />
            </button>
          )}
          <div className="h-full w-full overflow-hidden">
            <WidgetRenderer
              title={w.title}
              presetId={w.preset as PresetId}
              chartType={w.chartType}
              suffix={w.preset === "sla_compliance" ? "%" : undefined}
            />
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
