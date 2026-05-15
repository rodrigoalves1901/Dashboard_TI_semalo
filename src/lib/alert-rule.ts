// Avaliação de regras de alerta para widgets de métrica.
export type AlertOp = ">" | ">=" | "<" | "<=" | "=";

export type AlertThreshold = { op: AlertOp; value: number };

export type AlertRule = {
  warning?: AlertThreshold | null;
  critical?: AlertThreshold | null;
  blink?: boolean;
} | null;

export type AlertLevel = "critical" | "warning" | null;

export function evaluateAlert(value: number | string | null | undefined, rule: AlertRule): AlertLevel {
  if (!rule) return null;
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (rule.critical && match(n, rule.critical)) return "critical";
  if (rule.warning && match(n, rule.warning)) return "warning";
  return null;
}

function match(n: number, t: AlertThreshold): boolean {
  switch (t.op) {
    case ">": return n > t.value;
    case ">=": return n >= t.value;
    case "<": return n < t.value;
    case "<=": return n <= t.value;
    case "=": return n === t.value;
    default: return false;
  }
}

export const OP_LABEL: Record<AlertOp, string> = {
  ">": "maior que (>)",
  ">=": "maior ou igual (≥)",
  "<": "menor que (<)",
  "<=": "menor ou igual (≤)",
  "=": "igual a (=)",
};
