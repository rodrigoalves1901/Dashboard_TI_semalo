import { useMemo, useState } from "react";
import { Search, Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mockDetailRows, type DrilldownRow, type DrilldownTable } from "@/lib/drilldown";
import type { PresetId } from "@/lib/glpi-presets";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetTitle: string;
  presetId: PresetId | string;
  config: DrilldownTable;
  slice?: { name?: string } | null;
};

export function DrilldownTableSheet({ open, onOpenChange, widgetTitle, presetId, config, slice }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { columns, rows } = useMemo(() => mockDetailRows(presetId, slice), [presetId, slice]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list: DrilldownRow[] = q
      ? rows.filter((r) => columns.some((c) => String(r[c] ?? "").toLowerCase().includes(q)))
      : rows;
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
      });
    }
    return list;
  }, [rows, columns, search, sortKey, sortDir]);

  const exportCsv = () => {
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [columns.map(escape).join(","), ...filtered.map((r) => columns.map((c) => escape(r[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(config.title || widgetTitle || "detalhe").replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const title = config.title?.trim() || widgetTitle || "Detalhamento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[200] max-w-5xl p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">
              {title}
              {slice?.name && (
                <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {slice.name}
                </span>
              )}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {filtered.length} de {rows.length} {rows.length === 1 ? "linha" : "linhas"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card pl-8 pr-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-secondary"
          >
            <Download size={13} /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold hover:bg-secondary"
          >
            <X size={13} /> Fechar
          </button>
        </div>

        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-muted text-xs font-semibold text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    onClick={() => toggleSort(c)}
                    className="cursor-pointer select-none px-3 py-2 text-left hover:text-foreground"
                  >
                    {c}
                    {sortKey === c && <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum resultado.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={i} className="border-t border-border-soft hover:bg-secondary/50">
                    {columns.map((c) => (
                      <td key={c} className="px-3 py-2 text-foreground">
                        {String(r[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {config.sql && (
          <div className="border-t border-border bg-surface-muted px-5 py-2 text-[11px] text-muted-foreground">
            <span className="font-semibold">SQL configurada:</span>{" "}
            <code className="rounded bg-card px-1 py-0.5">{config.sql.slice(0, 160)}{config.sql.length > 160 ? "…" : ""}</code>
            <span className="ml-2 italic">(será executada quando a conexão real estiver plugada)</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
