import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  delta?: number;
  suffix?: string;
  bare?: boolean;
  /** Multiplier applied to the main value font-size. 1 = 100%. */
  valueScale?: number;
};

export function MetricCard({ label, value, delta, suffix, bare, valueScale = 1 }: Props) {
  const positive = (delta ?? 0) >= 0;
  const baseSize = 22;
  return (
    <div
      className={cn(
        "h-full p-4",
        bare ? "" : "rounded-[14px] border border-border bg-card shadow-card",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <div
          className="font-bold leading-tight text-foreground"
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
