import { useEffect, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { WidgetGrid } from "@/components/WidgetGrid";
import { getDashboard, listWidgets, subscribe, type Dashboard, type Widget } from "@/lib/data";
import { toast } from "sonner";

type Props = {
  dashboardId: string;
  /** Refresh interval in seconds. 0 disables auto-refresh. */
  intervalSeconds?: number;
  onExit?: () => void;
  /** When true, hides the built-in header (used inside SlideshowPlayer). */
  hideChrome?: boolean;
};

export function FullscreenDashboard({
  dashboardId,
  intervalSeconds = 0,
  onExit,
  hideChrome = false,
}: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);

  // Load + auto-refresh
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [d, ws] = await Promise.all([getDashboard(dashboardId), listWidgets(dashboardId)]);
        if (cancelled) return;
        setDashboard(d);
        setWidgets(ws);
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const unsub = subscribe(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [dashboardId, refreshKey]);

  // Refresh countdown
  useEffect(() => {
    if (!intervalSeconds || intervalSeconds <= 0) return;
    setSecondsLeft(intervalSeconds);
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRefreshKey((k) => k + 1);
          return intervalSeconds;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [intervalSeconds, dashboardId]);

  // Try to enter fullscreen on mount
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        /* user must click — ignore */
      });
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // ESC → exit
  useEffect(() => {
    if (!onExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const enterFullscreen = () => {
    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-auto">
      {/* Progress bar */}
      {intervalSeconds > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[110] h-1 bg-border/40">
          <div
            className="h-full bg-primary transition-[width] duration-1000 ease-linear"
            style={{ width: `${((intervalSeconds - secondsLeft) / intervalSeconds) * 100}%` }}
          />
        </div>
      )}

      {!hideChrome && (
        <header className="fixed top-2 right-2 z-[110] flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-popover backdrop-blur">
          {dashboard && (
            <span className="text-xs font-semibold text-foreground max-w-[40vw] truncate">
              {dashboard.name}
            </span>
          )}
          {intervalSeconds > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <RefreshCw size={12} /> {secondsLeft}s
            </span>
          )}
          <button
            onClick={enterFullscreen}
            className="text-[11px] text-muted-foreground hover:text-foreground"
            title="Tela cheia"
          >
            ⛶
          </button>
          {onExit && (
            <button
              onClick={onExit}
              aria-label="Sair"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </header>
      )}

      <div className="p-4 pt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !dashboard ? (
          <p className="text-sm text-muted-foreground">Dashboard não encontrado.</p>
        ) : widgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este dashboard não tem widgets.</p>
        ) : (
          <WidgetGrid key={refreshKey} widgets={widgets} editable={false} />
        )}
      </div>
    </div>
  );
}
