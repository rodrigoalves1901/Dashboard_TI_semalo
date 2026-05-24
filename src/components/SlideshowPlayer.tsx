import { useEffect, useRef, useState } from "react";
import { X, Pause, Play, SkipBack, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { FullscreenDashboard } from "./FullscreenDashboard";
import type { Dashboard } from "@/lib/data";

export type SlideshowEntry = {
  dashboard: Dashboard;
  seconds: number;
};

type Props = {
  entries: SlideshowEntry[];
  onExit: () => void;
};

export function SlideshowPlayer({ entries, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const autoPaused = paused || drilldownOpen;

  const current = entries[index];
  const totalMs = (current?.seconds ?? 30) * 1000;

  const next = () => setIndex((i) => (i + 1) % entries.length);
  const prev = () => setIndex((i) => (i - 1 + entries.length) % entries.length);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, entries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Playlist vazia.</p>
      </div>
    );
  }

  return (
    <>
      <FullscreenDashboard
        dashboardId={current.dashboard.id}
        intervalSeconds={0}
        hideChrome
        onDrilldownOpenChange={setDrilldownOpen}
      />
      {/* Top progress bar (slideshow) */}
      <SlideshowProgressBar totalMs={totalMs} autoPaused={autoPaused} onTimeout={next} />

      {/* Top-right info */}
      <div className="fixed top-2 right-2 z-[120] flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 shadow-popover backdrop-blur">
        <span className="text-[11px] font-semibold text-muted-foreground">
          {index + 1}/{entries.length}
        </span>
        <span className="text-xs font-semibold text-foreground max-w-[40vw] truncate">
          {current.dashboard.name}
        </span>
      </div>

      {/* Bottom-right controls (collapsible) */}
      <div className="fixed bottom-3 right-3 z-[120] flex items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1 shadow-popover backdrop-blur">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expandir controles" : "Minimizar controles"}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {!collapsed && (
          <>
            <button
              onClick={prev}
              aria-label="Anterior"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar" : "Pausar"}
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              onClick={next}
              aria-label="Próximo"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <SkipForward size={14} />
            </button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button
              onClick={onExit}
              aria-label="Sair"
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

function SlideshowProgressBar({
  totalMs,
  autoPaused,
  onTimeout,
}: {
  totalMs: number;
  autoPaused: boolean;
  onTimeout: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number>(Date.now());

  // Reset timer when slide changes
  useEffect(() => {
    startedAt.current = Date.now();
    setElapsedMs(0);
  }, [totalMs]);

  // Tick
  useEffect(() => {
    if (autoPaused) return;
    const id = setInterval(() => {
      const e = Date.now() - startedAt.current;
      if (e >= totalMs) {
        onTimeout();
      } else {
        setElapsedMs(e);
      }
    }, 100);
    return () => clearInterval(id);
  }, [autoPaused, totalMs, onTimeout]);

  // Pause adjusts startedAt to keep elapsed correct on resume
  useEffect(() => {
    if (autoPaused) return;
    startedAt.current = Date.now() - elapsedMs;
  }, [autoPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.min(100, (elapsedMs / totalMs) * 100);

  return (
    <div className="fixed top-0 left-0 right-0 z-[120] h-1 bg-border/40">
      <div
        className="h-full bg-primary transition-[width] duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
