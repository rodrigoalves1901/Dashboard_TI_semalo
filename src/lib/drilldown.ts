// Tipos e utilidades para a ação de clique (drill-down) de cada widget.
import type { PresetId } from "@/lib/glpi-presets";

export type DrilldownTable = {
  type: "table";
  title?: string | null;
  connectionId?: string | null;
  sql?: string | null;
};

export type DrilldownDashboard = {
  type: "dashboard";
  dashboardId: string;
};

export type DrilldownConfig = DrilldownTable | DrilldownDashboard | null;

export type DrilldownRow = Record<string, string | number>;

/**
 * Gera linhas mockadas para a planilha de detalhe enquanto o pipeline real
 * de SQL não está plugado. Quando o backend de execução de query estiver
 * disponível, troque esta função por uma chamada server-side.
 */
export function mockDetailRows(
  presetId: PresetId | string,
  slice?: { name?: string } | null,
): { columns: string[]; rows: DrilldownRow[] } {
  const columns = ["#", "Título", "Solicitante", "Categoria", "Prioridade", "Status", "Aberto em"];
  const cats = ["Hardware", "Software", "Rede", "Acessos", "Impressão", "Email"];
  const prios = ["Baixa", "Média", "Alta", "Muito alta", "Crítica"];
  const statuses = ["Novo", "Atribuído", "Processando", "Pendente", "Resolvido"];
  const users = ["A. Souza", "B. Lima", "C. Pereira", "D. Oliveira", "E. Santos", "F. Costa"];
  const titles = [
    "Acesso ao sistema bloqueado",
    "Notebook não liga",
    "VPN intermitente",
    "Erro ao imprimir relatório",
    "Solicitação de licença Office",
    "Outlook travando ao abrir anexos",
    "Solicitação de monitor adicional",
    "Senha do AD expirada",
    "Sem acesso ao compartilhamento",
    "Lentidão no ERP",
    "Reset de MFA",
    "Cadastro de novo colaborador",
  ];

  const seed = (presetId + (slice?.name ?? "")).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = 25 + (seed % 18);
  const rows: DrilldownRow[] = [];
  for (let i = 0; i < count; i++) {
    const k = (seed + i) % 9973;
    const cat = slice?.name && cats.includes(slice.name) ? slice.name : cats[k % cats.length];
    const prio =
      slice?.name && prios.includes(slice.name) ? slice.name : prios[(k * 3) % prios.length];
    const status =
      slice?.name && statuses.includes(slice.name)
        ? slice.name
        : statuses[(k * 7) % statuses.length];
    const d = new Date(Date.now() - ((k * 137) % 60) * 86400000);
    rows.push({
      "#": 10000 + i + (seed % 500),
      Título: titles[(k * 11) % titles.length],
      Solicitante: users[(k * 5) % users.length],
      Categoria: cat,
      Prioridade: prio,
      Status: status,
      "Aberto em": d.toISOString().slice(0, 10),
    });
  }
  return { columns, rows };
}
