// Pre-built GLPI metrics. In a real backend each preset maps to a SQL query
// against the GLPI MySQL database. Here they generate mock data for the UI.

export type PresetId =
  | "custom_sql"
  | "tickets_open"
  | "tickets_solved"
  | "tickets_pending"
  | "tickets_late"
  | "tickets_by_status"
  | "tickets_by_category"
  | "tickets_by_technician"
  | "tickets_by_priority"
  | "tickets_evolution"
  | "sla_compliance";

export type PresetMeta = {
  id: PresetId;
  label: string;
  description: string;
  defaultChart: "metric" | "bar" | "line" | "donut" | "table";
  category: "Tickets" | "SLA" | "Operação";
  sql?: string;
};

export const PRESETS: PresetMeta[] = [
  {
    id: "tickets_open",
    label: "Tickets em aberto",
    description: "Total de tickets com status novo/atribuído/processando",
    defaultChart: "metric",
    category: "Tickets",
  },
  {
    id: "tickets_solved",
    label: "Tickets resolvidos",
    description: "Tickets fechados nos últimos 30 dias",
    defaultChart: "metric",
    category: "Tickets",
  },
  {
    id: "tickets_pending",
    label: "Tickets pendentes",
    description: "Tickets aguardando aprovação",
    defaultChart: "metric",
    category: "Tickets",
  },
  {
    id: "tickets_late",
    label: "Tickets atrasados",
    description: "Tickets com SLA estourado",
    defaultChart: "metric",
    category: "SLA",
  },
  {
    id: "tickets_by_status",
    label: "Tickets por status",
    description: "Distribuição por status atual",
    defaultChart: "donut",
    category: "Tickets",
  },
  {
    id: "tickets_by_category",
    label: "Tickets por categoria",
    description: "Top categorias",
    defaultChart: "bar",
    category: "Tickets",
  },
  {
    id: "tickets_by_technician",
    label: "Tickets por técnico",
    description: "Carga atribuída por técnico",
    defaultChart: "bar",
    category: "Operação",
  },
  {
    id: "tickets_by_priority",
    label: "Tickets por prioridade",
    description: "Distribuição por prioridade",
    defaultChart: "donut",
    category: "Tickets",
  },
  {
    id: "tickets_evolution",
    label: "Evolução de tickets",
    description: "Abertos vs resolvidos por semana",
    defaultChart: "line",
    category: "Tickets",
  },
  {
    id: "sla_compliance",
    label: "Cumprimento de SLA",
    description: "% de tickets dentro do SLA",
    defaultChart: "metric",
    category: "SLA",
  },
];

export function getPreset(id: string): PresetMeta | undefined {
  return PRESETS.find((p) => p.id === id);
}

// Deterministic mock data per preset so the UI feels alive.
export function mockData(presetId: PresetId): {
  value?: number;
  delta?: number;
  series?: { name: string; value: number }[];
  timeSeries?: { date: string; opened: number; solved: number }[];
  rows?: Record<string, string | number>[];
} {
  switch (presetId) {
    case "tickets_open":
      return { value: 184, delta: 4.2 };
    case "tickets_solved":
      return { value: 612, delta: 8.7 };
    case "tickets_pending":
      return { value: 27, delta: -2.1 };
    case "tickets_late":
      return { value: 13, delta: -12.4 };
    case "sla_compliance":
      return { value: 92, delta: 1.3 };
    case "tickets_by_status":
      return {
        series: [
          { name: "Novo", value: 64 },
          { name: "Atribuído", value: 78 },
          { name: "Processando", value: 42 },
          { name: "Pendente", value: 27 },
          { name: "Resolvido", value: 156 },
          { name: "Fechado", value: 412 },
        ],
      };
    case "tickets_by_priority":
      return {
        series: [
          { name: "Muito baixa", value: 22 },
          { name: "Baixa", value: 84 },
          { name: "Média", value: 162 },
          { name: "Alta", value: 73 },
          { name: "Muito alta", value: 18 },
          { name: "Crítica", value: 6 },
        ],
      };
    case "tickets_by_category":
      return {
        series: [
          { name: "Hardware", value: 86 },
          { name: "Software", value: 134 },
          { name: "Rede", value: 52 },
          { name: "Acessos", value: 78 },
          { name: "Impressão", value: 31 },
          { name: "Email", value: 44 },
        ],
      };
    case "tickets_by_technician":
      return {
        series: [
          { name: "A. Souza", value: 42 },
          { name: "B. Lima", value: 38 },
          { name: "C. Pereira", value: 31 },
          { name: "D. Oliveira", value: 28 },
          { name: "E. Santos", value: 22 },
          { name: "F. Costa", value: 19 },
        ],
      };
    case "tickets_evolution":
      return {
        timeSeries: [
          { date: "Sem 1", opened: 48, solved: 41 },
          { date: "Sem 2", opened: 52, solved: 49 },
          { date: "Sem 3", opened: 61, solved: 55 },
          { date: "Sem 4", opened: 44, solved: 58 },
          { date: "Sem 5", opened: 67, solved: 62 },
          { date: "Sem 6", opened: 58, solved: 64 },
          { date: "Sem 7", opened: 72, solved: 68 },
          { date: "Sem 8", opened: 65, solved: 71 },
        ],
      };
  }
  return {};
}
