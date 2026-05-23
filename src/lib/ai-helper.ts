import { runExplorerQuery } from "@/lib/explorer.functions";
import { mockData, type PresetId } from "@/lib/glpi-presets";
import type { Widget } from "@/lib/data";

/**
 * Programmatically fetches the live (or preset) value of a widget for AI narration.
 * This decouples the AI voice narration from page DOM elements.
 */
export async function fetchWidgetValue(widget: Widget): Promise<string> {
  if (widget.chartType === "divider" || widget.chartType === "markdown") {
    return "";
  }

  try {
    let valStr = "N/A";
    if (widget.preset && widget.preset !== "custom_sql") {
      // Preset data
      const mock = mockData(widget.preset as PresetId);
      if (mock) {
        if (mock.value !== undefined) {
          valStr = `${mock.value}`;
        } else if (mock.series) {
          valStr = mock.series.map((s: any) => `${s.name}: ${s.value}`).join(", ");
        } else if (mock.timeSeries) {
          valStr = mock.timeSeries
            .map((t: any) => `${t.date} (Abertos: ${t.opened}, Resolvidos: ${t.solved})`)
            .join(", ");
        }
      }
    } else if (widget.connectionId && widget.content) {
      // Custom SQL widget - run the query programmatically
      const rawData = await runExplorerQuery({
        data: {
          connectionId: widget.connectionId,
          query: widget.content,
        },
      });

      if (rawData && rawData.length > 0) {
        if (widget.chartType === "metric") {
          const firstRow = rawData[0];
          const val = Object.values(firstRow)[0];
          valStr = String(val ?? 0);
        } else if (
          widget.chartType === "table" ||
          widget.chartType === "donut" ||
          widget.chartType === "bar"
        ) {
          if (rawData.length === 1) {
            valStr = Object.entries(rawData[0])
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
          } else {
            valStr = rawData
              .slice(0, 5) // Limit to top 5 for clean and prompt-friendly voice reporting
              .map((row) => {
                const vals = Object.values(row);
                return `${vals[0]}: ${vals[1] ?? 0}`;
              })
              .join(", ");
          }
        } else {
          valStr = String(Object.values(rawData[0])[0] ?? "N/A");
        }
      }
    }
    return valStr;
  } catch (err) {
    console.error(`Error loading background data for widget "${widget.title}":`, err);
    return "Erro ao carregar dados";
  }
}
