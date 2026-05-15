import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OP_LABEL, type AlertOp, type AlertRule, type AlertThreshold } from "@/lib/alert-rule";

type Props = {
  rule: AlertRule;
  onChange: (rule: AlertRule) => void;
};

const OPS: AlertOp[] = [">", ">=", "<", "<=", "="];

function defaultThreshold(): AlertThreshold {
  return { op: ">", value: 0 };
}

export function WidgetAlertDialog({ rule, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [warnEnabled, setWarnEnabled] = useState<boolean>(!!rule?.warning);
  const [critEnabled, setCritEnabled] = useState<boolean>(!!rule?.critical);
  const [warning, setWarning] = useState<AlertThreshold>(rule?.warning ?? defaultThreshold());
  const [critical, setCritical] = useState<AlertThreshold>(rule?.critical ?? { op: ">", value: 50 });
  const [blink, setBlink] = useState<boolean>(rule?.blink ?? true);

  const hasRule = !!rule && (!!rule.warning || !!rule.critical);

  const save = () => {
    if (!warnEnabled && !critEnabled) {
      onChange(null);
    } else {
      onChange({
        warning: warnEnabled ? warning : null,
        critical: critEnabled ? critical : null,
        blink,
      });
    }
    setOpen(false);
  };

  const clear = () => {
    setWarnEnabled(false);
    setCritEnabled(false);
    onChange(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title={hasRule ? "Editar alerta" : "Configurar alerta"}
          className={
            hasRule
              ? "grid h-6 w-6 place-items-center rounded-md bg-destructive/15 text-destructive shadow-sm hover:bg-destructive/25"
              : "grid h-6 w-6 place-items-center rounded-md bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground"
          }
          aria-label="Configurar alerta"
        >
          {hasRule ? <Bell size={13} /> : <BellOff size={13} />}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alerta por limite</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <p className="text-xs text-muted-foreground">
            Quando o valor da métrica satisfizer a condição, o card muda de cor.
            Configure um ou os dois níveis.
          </p>

          <ThresholdRow
            label="Atenção (amarelo)"
            color="warning"
            enabled={warnEnabled}
            onToggle={setWarnEnabled}
            value={warning}
            onChange={setWarning}
          />
          <ThresholdRow
            label="Crítico (vermelho)"
            color="critical"
            enabled={critEnabled}
            onToggle={setCritEnabled}
            value={critical}
            onChange={setCritical}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={blink}
              onChange={(e) => setBlink(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Piscar quando em alerta
          </label>
        </div>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={clear}
            className="h-9 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-secondary"
          >
            Remover alerta
          </button>
          <button
            type="button"
            onClick={save}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThresholdRow({
  label,
  color,
  enabled,
  onToggle,
  value,
  onChange,
}: {
  label: string;
  color: "warning" | "critical";
  enabled: boolean;
  onToggle: (b: boolean) => void;
  value: AlertThreshold;
  onChange: (t: AlertThreshold) => void;
}) {
  const dotClass = color === "critical" ? "bg-destructive" : "bg-[var(--warning)]";
  return (
    <div className="rounded-lg border border-border p-3">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </label>
      {enabled && (
        <div className="mt-3 flex items-center gap-2">
          <select
            value={value.op}
            onChange={(e) => onChange({ ...value, op: e.target.value as AlertOp })}
            className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-sm"
          >
            {OPS.map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op]}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={Number.isFinite(value.value) ? value.value : 0}
            onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
            className="h-9 w-28 rounded-md border border-border bg-card px-2 text-sm tabular-nums"
            step="any"
          />
        </div>
      )}
    </div>
  );
}
