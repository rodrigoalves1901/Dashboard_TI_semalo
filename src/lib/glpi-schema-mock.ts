// Catálogo mockado de tabelas/colunas estilo GLPI para o Explorer.

export type ColumnDef = { name: string; type: string; nullable?: boolean; pk?: boolean };
export type TableDef = {
  name: string;
  description: string;
  columns: ColumnDef[];
  rows: Record<string, string | number | null>[];
};

export const GLPI_TABLES: TableDef[] = [
  {
    name: "glpi_tickets",
    description: "Chamados / tickets registrados",
    columns: [
      { name: "id", type: "int", pk: true },
      { name: "name", type: "varchar(255)" },
      { name: "status", type: "tinyint" },
      { name: "priority", type: "tinyint" },
      { name: "users_id_recipient", type: "int" },
      { name: "users_id_lastupdater", type: "int" },
      { name: "date", type: "datetime" },
      { name: "solvedate", type: "datetime", nullable: true },
      { name: "closedate", type: "datetime", nullable: true },
    ],
    rows: [
      { id: 1, name: "Notebook não liga", status: 2, priority: 4, users_id_recipient: 7, users_id_lastupdater: 3, date: "2026-05-10 09:21:00", solvedate: null, closedate: null },
      { id: 2, name: "VPN caindo", status: 4, priority: 3, users_id_recipient: 12, users_id_lastupdater: 5, date: "2026-05-09 14:02:00", solvedate: "2026-05-10 11:00:00", closedate: null },
      { id: 3, name: "Solicitação de acesso ao ERP", status: 1, priority: 2, users_id_recipient: 9, users_id_lastupdater: 9, date: "2026-05-12 08:00:00", solvedate: null, closedate: null },
      { id: 4, name: "Impressora offline", status: 6, priority: 3, users_id_recipient: 18, users_id_lastupdater: 5, date: "2026-05-08 10:34:00", solvedate: "2026-05-08 16:20:00", closedate: "2026-05-09 08:00:00" },
      { id: 5, name: "Reset de senha AD", status: 6, priority: 1, users_id_recipient: 22, users_id_lastupdater: 3, date: "2026-05-11 07:45:00", solvedate: "2026-05-11 07:55:00", closedate: "2026-05-11 08:00:00" },
    ],
  },
  {
    name: "glpi_users",
    description: "Usuários do sistema (técnicos e solicitantes)",
    columns: [
      { name: "id", type: "int", pk: true },
      { name: "name", type: "varchar(255)" },
      { name: "realname", type: "varchar(255)" },
      { name: "firstname", type: "varchar(255)" },
      { name: "is_active", type: "tinyint" },
      { name: "groups_id", type: "int" },
    ],
    rows: [
      { id: 3, name: "asouza", realname: "Souza", firstname: "Ana", is_active: 1, groups_id: 1 },
      { id: 5, name: "blima", realname: "Lima", firstname: "Bruno", is_active: 1, groups_id: 1 },
      { id: 7, name: "cpereira", realname: "Pereira", firstname: "Carla", is_active: 1, groups_id: 2 },
      { id: 9, name: "doliveira", realname: "Oliveira", firstname: "Diego", is_active: 1, groups_id: 2 },
    ],
  },
  {
    name: "glpi_groups",
    description: "Grupos / filas de atendimento",
    columns: [
      { name: "id", type: "int", pk: true },
      { name: "name", type: "varchar(255)" },
      { name: "comment", type: "text", nullable: true },
    ],
    rows: [
      { id: 1, name: "Suporte N1", comment: "Primeiro nível" },
      { id: 2, name: "Suporte N2", comment: "Especialistas" },
      { id: 3, name: "Infraestrutura", comment: "Redes e servidores" },
    ],
  },
  {
    name: "glpi_itilcategories",
    description: "Categorias de chamado",
    columns: [
      { name: "id", type: "int", pk: true },
      { name: "name", type: "varchar(255)" },
      { name: "completename", type: "varchar(255)" },
    ],
    rows: [
      { id: 1, name: "Hardware", completename: "Hardware" },
      { id: 2, name: "Software", completename: "Software" },
      { id: 3, name: "Rede", completename: "Rede" },
      { id: 4, name: "Acessos", completename: "Acessos" },
      { id: 5, name: "Impressão", completename: "Impressão" },
      { id: 6, name: "Email", completename: "Email" },
    ],
  },
  {
    name: "glpi_tickets_users",
    description: "Relação técnicos/solicitantes ↔ tickets",
    columns: [
      { name: "id", type: "int", pk: true },
      { name: "tickets_id", type: "int" },
      { name: "users_id", type: "int" },
      { name: "type", type: "tinyint", nullable: false },
    ],
    rows: [
      { id: 1, tickets_id: 1, users_id: 3, type: 2 },
      { id: 2, tickets_id: 2, users_id: 5, type: 2 },
      { id: 3, tickets_id: 3, users_id: 9, type: 1 },
      { id: 4, tickets_id: 4, users_id: 5, type: 2 },
    ],
  },
];

export function getTable(name: string): TableDef | undefined {
  return GLPI_TABLES.find((t) => t.name === name);
}
