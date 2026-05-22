import { ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/lib/alert-rule";
import type { WidgetStyles } from "@/lib/data";

type Props = {
  label: string;
  value: string | number;
  delta?: number;
  deltaValue?: number;
  suffix?: string;
  bare?: boolean;
  /** Multiplier applied to the main value font-size. 1 = 100%. */
  valueScale?: number;
  alertLevel?: AlertLevel;
  alertBlink?: boolean;
  styles?: WidgetStyles;
};

export function MetricCard({
  label,
  value,
  delta,
  deltaValue,
  suffix,
  bare,
  valueScale = 1,
  alertLevel,
  alertBlink,
  styles = {},
}: Props) {
  const positive = (delta ?? deltaValue ?? 0) >= 0;
  const baseSize = 22;
  const baseTitleSize = 12;

  const alertClass =
    alertLevel === "critical"
      ? "alert-critical"
      : alertLevel === "important"
        ? "alert-important"
        : alertLevel === "warning"
          ? "alert-warning"
          : "";

  return (
    <div
      className={cn(
        "h-full p-4 transition-colors flex flex-col",
        bare ? "" : "rounded-[14px] border border-border bg-card shadow-card",
        alertClass,
        alertLevel && alertBlink ? "alert-blink" : "",
        styles.centerTitle || styles.centerValue ? "items-center" : "",
      )}
    >
      <div
        className={cn(
          "alert-label flex items-center gap-1.5 font-medium text-muted-foreground",
          styles.centerTitle ? "justify-center w-full" : "",
        )}
        style={{
          fontSize: `${baseTitleSize * (styles.titleSize ?? 1)}px`,
          fontWeight: styles.titleBold ? "bold" : undefined,
          color: styles.titleColor || undefined,
        }}
      >
        {alertLevel && (
          <AlertTriangle
            size={12 * (styles.titleSize ?? 1)}
            className={
              alertLevel === "critical"
                ? "text-destructive"
                : alertLevel === "important"
                  ? "text-[var(--important)]"
                  : "text-[var(--warning)]"
            }
          />
        )}
        {label}
      </div>
      <div
        className={cn(
          "mt-2 flex items-baseline gap-1",
          styles.centerValue ? "justify-center w-full" : "",
        )}
      >
        <div
          className="alert-value font-bold leading-tight text-foreground"
          style={{
            fontSize: `${baseSize * valueScale}px`,
            lineHeight: 1.05,
          }}
        >
          {value}
        </div>
        {suffix && (
          <div
            className="text-muted-foreground"
            style={{ fontSize: `${14 * (valueScale * 0.7)}px` }}
          >
            {suffix}
          </div>
        )}
      </div>
      {(delta !== undefined || deltaValue !== undefined) && (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-semibold",
            positive ? "text-success" : "text-destructive",
            styles.centerValue ? "justify-center w-full" : "",
          )}
        >
          {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {deltaValue !== undefined && (
            <span>{deltaValue > 0 ? `+${deltaValue}` : deltaValue} </span>
          )}
          {delta !== undefined && <span>({Math.abs(delta).toFixed(1)}%)</span>}
          <span className="ml-1 font-normal opacity-70 text-[10px]">vs anterior</span>
        </div>
      )}
    </div>
  );
}
