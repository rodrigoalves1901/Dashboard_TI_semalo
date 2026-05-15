import { ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/lib/alert-rule";

type Props = {
  label: string;
  value: string | number;
  delta?: number;
  suffix?: string;
  bare?: boolean;
  /** Multiplier applied to the main value font-size. 1 = 100%. */
  valueScale?: number;
  alertLevel?: AlertLevel;
  alertBlink?: boolean;
};

export function MetricCard({ label, value, delta, suffix, bare, valueScale = 1, alertLevel, alertBlink }: Props) {
  const positive = (delta ?? 0) >= 0;
  const baseSize = 22;
  const alertClass = alertLevel === "critical"
    ? "alert-critical"
    : alertLevel === "warning"
      ? "alert-warning"
      : "";
  return (
    <div
      className={cn(
        "h-full p-4 transition-colors",
        bare ? "" : "rounded-[14px] border border-border bg-card shadow-card",
        alertClass,
        alertLevel && alertBlink ? "alert-blink" : "",
      )}
    >
      <div className="alert-label flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {alertLevel && (
          <AlertTriangle
            size={12}
            className={alertLevel === "critical" ? "text-destructive" : "text-[var(--warning)]"}
          />
        )}
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <div
          className="alert-value font-bold leading-tight text-foreground"
          style={{ fontSize: `${baseSize * valueScale}px`, lineHeight: 1.05 }}
        >
          {value}
        </div>
        {suffix && <div className="text-sm text-muted-foreground">{suffix}</div>}
      </div>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-semibold",
            positive ? "text-success" : "text-destructive",
          )}
        >
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta).toFixed(1)}% vs período anterior
        </div>
      )}
    </div>
  );
}
