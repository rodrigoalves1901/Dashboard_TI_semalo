import { useEffect, useState } from "react";
import { X, RefreshCw, Minus, Plus } from "lucide-react";
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
  /** Initial font/zoom scale (1 = 100%). */
  initialScale?: number;
  /** Forwarded to WidgetGrid so the slideshow can pause while drilldown is open. */
  onDrilldownOpenChange?: (open: boolean) => void;
};

const SCALE_KEY = "flup.fullscreenScale";

export function FullscreenDashboard({
  dashboardId,
  intervalSeconds = 0,
  onExit,
  hideChrome = false,
  initialScale,
  onDrilldownOpenChange,
}: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);
  const [scale, setScale] = useState<number>(() => {
    if (initialScale) return initialScale;
    if (typeof window !== "undefined") {
      const v = Number(window.localStorage.getItem(SCALE_KEY));
      if (Number.isFinite(v) && v >= 0.5 && v <= 3) return v;
    }
    return 1;
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !initialScale) {
      window.localStorage.setItem(SCALE_KEY, String(scale));
    }
  }, [scale, initialScale]);

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

  // Try to enter fullscreen on mount. Do NOT auto-exit on unmount —
  // remounting (e.g. slideshow advancing) would otherwise drop fullscreen.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        /* user must click — ignore */
      });
    }
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

  const handleExit = () => {
    if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    onExit?.();
  };

  const enterFullscreen = () => {
    if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const decScale = () => setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(2)));
  const incScale = () => setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(2)));

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
        <header className="fixed top-2 right-2 z-[110] flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-1.5 shadow-popover backdrop-blur">
          {dashboard && (
            <span className="px-1 text-xs font-semibold text-foreground max-w-[30vw] truncate">
              {dashboard.name}
            </span>
          )}
          {intervalSeconds > 0 && (
            <span className="inline-flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
              <RefreshCw size={12} /> {secondsLeft}s
            </span>
          )}
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={decScale}
            aria-label="Diminuir texto"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Minus size={12} />
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={incScale}
            aria-label="Aumentar texto"
            className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Plus size={12} />
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            onClick={enterFullscreen}
            className="text-[11px] text-muted-foreground hover:text-foreground px-1"
            title="Tela cheia"
          >
            ⛶
          </button>
          {onExit && (
            <button
              onClick={handleExit}
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
          <div
            style={{
              fontSize: `${scale}rem`,
              transform: scale !== 1 ? `scale(${scale})` : undefined,
              transformOrigin: "top left",
              width: scale !== 1 ? `${100 / scale}%` : "100%",
            }}
          >
            <WidgetGrid
              key={refreshKey}
              widgets={widgets}
              editable={false}
              onDrilldownOpenChange={onDrilldownOpenChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
