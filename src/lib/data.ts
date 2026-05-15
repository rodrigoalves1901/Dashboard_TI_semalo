// Supabase-backed data layer for orgs, connections, dashboards, widgets.
import { supabase } from "@/integrations/supabase/client";
import { createOrgOnServer } from "@/lib/orgs.functions";
import type { AlertRule } from "@/lib/alert-rule";
import type { DrilldownConfig } from "@/lib/drilldown";

export type Org = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
};

export type SystemType = "mysql" | "mariadb" | "sqlserver" | "sharepoint" | "demo";

export type Connection = {
  id: string;
  orgId: string;
  name: string;
  systemType: SystemType;
  // For DBs (mysql/mariadb/sqlserver): host/port/database/username/password
  // For SharePoint: host=tenantId, database=siteUrl (e.g. contoso.sharepoint.com:/sites/Marketing),
  //                 username=clientId, password=clientSecret, port=443
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  createdAt: string;
};

export type ChartType = "metric" | "bar" | "line" | "donut" | "table" | "markdown" | "divider";

export type Dashboard = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  createdAt: string;
};

export type WidgetPosition = { x: number; y: number; w: number; h: number };

export type Widget = {
  id: string;
  dashboardId: string;
  connectionId: string | null;
  title: string;
  chartType: ChartType;
  preset: string;
  refreshInterval: number;
  position: WidgetPosition | null;
  content: string | null;
  /** Multiplier for the metric value font-size. 1 = 100%. */
  valueScale: number;
  /** Optional alert thresholds for metric widgets. */
  alertRule: AlertRule;
  /** Optional click action: open detail table or navigate to another dashboard. */
  drilldown: DrilldownConfig;
};

// ---------- Tiny refresh emitter ----------
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emit() {
  for (const l of Array.from(listeners)) l();
}

// ---------- Current org (local pointer) ----------
const CURRENT_ORG_KEY = "flup.currentOrgId";
export function getCurrentOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_ORG_KEY);
}
export function setCurrentOrgId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(CURRENT_ORG_KEY, id);
  else localStorage.removeItem(CURRENT_ORG_KEY);
  emit();
}

// ---------- Orgs ----------
export async function listMyOrgs(): Promise<Org[]> {
  const { data, error } = await supabase
    .from("orgs")
    .select("id,name,owner_id,created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    createdAt: r.created_at,
  }));
}

export async function createOrg(name: string): Promise<Org> {
  const { data: sessionRes } = await supabase.auth.getSession();
  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) throw new Error("Não autenticado");
  const data = await createOrgOnServer({ data: { name, accessToken } });
  emit();
  return {
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    createdAt: data.created_at,
  };
}

// ---------- Connections ----------
export async function listConnections(orgId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapConnection);
}

export async function createConnection(input: Omit<Connection, "id" | "createdAt">): Promise<Connection> {
  const { data, error } = await supabase
    .from("connections")
    .insert({
      org_id: input.orgId,
      name: input.name,
      system_type: input.systemType,
      host: input.host,
      port: input.port,
      database: input.database,
      username: input.username,
      password: input.password,
      ssl: input.ssl,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit();
  return mapConnection(data);
}

export async function deleteConnection(id: string) {
  const { error } = await supabase.from("connections").delete().eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

function mapConnection(r: any): Connection {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    systemType: r.system_type,
    host: r.host,
    port: r.port,
    database: r.database,
    username: r.username,
    password: r.password,
    ssl: r.ssl,
    createdAt: r.created_at,
  };
}

// ---------- Dashboards ----------
export async function listDashboards(orgId: string): Promise<Dashboard[]> {
  const { data, error } = await supabase
    .from("dashboards")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDashboard);
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const { data, error } = await supabase.from("dashboards").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapDashboard(data) : null;
}

export async function createDashboard(orgId: string, name: string, description = ""): Promise<Dashboard> {
  const { data, error } = await supabase
    .from("dashboards")
    .insert({ org_id: orgId, name, description })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit();
  return mapDashboard(data);
}

export async function updateDashboard(id: string, patch: Partial<Pick<Dashboard, "name" | "description">>) {
  const { error } = await supabase.from("dashboards").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function deleteDashboard(id: string) {
  const { error } = await supabase.from("dashboards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

function mapDashboard(r: any): Dashboard {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    description: r.description ?? "",
    createdAt: r.created_at,
  };
}

// ---------- Widgets ----------
export async function listWidgets(dashboardId: string): Promise<Widget[]> {
  const { data, error } = await supabase
    .from("widgets")
    .select("*")
    .eq("dashboard_id", dashboardId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWidget);
}

export async function createWidget(
  input: Omit<Widget, "id" | "valueScale" | "alertRule" | "drilldown"> & {
    valueScale?: number;
    alertRule?: AlertRule;
    drilldown?: DrilldownConfig;
  },
): Promise<Widget> {
  const { data, error } = await supabase
    .from("widgets")
    .insert({
      dashboard_id: input.dashboardId,
      connection_id: input.connectionId,
      title: input.title,
      chart_type: input.chartType,
      preset: input.preset || null,
      refresh_interval: input.refreshInterval,
      content: input.content,
      position: input.position,
      value_scale: input.valueScale ?? 1,
      alert_rule: input.alertRule ?? null,
      drilldown: input.drilldown ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit();
  return mapWidget(data);
}

export async function deleteWidget(id: string) {
  const { error } = await supabase.from("widgets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetPosition(id: string, position: WidgetPosition) {
  const { error } = await supabase
    .from("widgets")
    .update({ position })
    .eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetValueScale(id: string, valueScale: number) {
  const clamped = Math.min(6, Math.max(0.5, Math.round(valueScale * 100) / 100));
  const { error } = await supabase
    .from("widgets")
    .update({ value_scale: clamped })
    .eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetAlertRule(id: string, rule: AlertRule) {
  const { error } = await supabase
    .from("widgets")
    .update({ alert_rule: rule })
    .eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetDrilldown(id: string, drilldown: DrilldownConfig) {
  const { error } = await supabase
    .from("widgets")
    .update({ drilldown })
    .eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

function mapWidget(r: any): Widget {
  const vs = Number(r.value_scale);
  return {
    id: r.id,
    dashboardId: r.dashboard_id,
    connectionId: r.connection_id,
    title: r.title,
    chartType: r.chart_type,
    preset: r.preset ?? "",
    refreshInterval: r.refresh_interval,
    position: (r.position as WidgetPosition | null) ?? null,
    content: (r.content as string | null) ?? null,
    valueScale: Number.isFinite(vs) && vs > 0 ? vs : 1,
    alertRule: (r.alert_rule as AlertRule) ?? null,
    drilldown: (r.drilldown as DrilldownConfig) ?? null,
  };
}

// ---------- Sample dashboard ----------
export async function createSampleDashboard(orgId: string): Promise<Dashboard> {
  const dash = await createDashboard(
    orgId,
    "Modelo — Todos os widgets",
    "Dashboard de referência com exemplos de cada tipo de widget, incluindo cards de texto/markdown e divisórias.",
  );

  const items: Array<Omit<Widget, "id" | "dashboardId" | "valueScale" | "alertRule"> & { valueScale?: number; alertRule?: AlertRule }> = [
    { connectionId: null, title: "Visão geral", chartType: "divider", preset: "", refreshInterval: 0, position: { x: 0, y: 0, w: 12, h: 1 }, content: null },
    { connectionId: null, title: "Tickets em aberto", chartType: "metric", preset: "tickets_open", refreshInterval: 60, position: { x: 0, y: 1, w: 3, h: 2 }, content: null },
    { connectionId: null, title: "Tickets resolvidos", chartType: "metric", preset: "tickets_solved", refreshInterval: 60, position: { x: 3, y: 1, w: 3, h: 2 }, content: null },
    { connectionId: null, title: "Tickets pendentes", chartType: "metric", preset: "tickets_pending", refreshInterval: 60, position: { x: 6, y: 1, w: 3, h: 2 }, content: null },
    { connectionId: null, title: "Tickets atrasados", chartType: "metric", preset: "tickets_late", refreshInterval: 60, position: { x: 9, y: 1, w: 3, h: 2 }, content: null },
    {
      connectionId: null,
      title: "Sobre este dashboard",
      chartType: "markdown",
      preset: "",
      refreshInterval: 0,
      position: { x: 0, y: 3, w: 12, h: 3 },
      content:
        "## Bem-vindo ao dashboard modelo\n\nEste dashboard reúne **todos os tipos de widgets** disponíveis. Use-o como referência ao montar os seus.\n\n- 📊 Métricas, barras, linhas, donut e tabela\n- 📝 Cards de texto em **Markdown** (com suporte a imagens)\n- ➖ Divisórias para organizar seções\n\n![Exemplo](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=200&fit=crop)",
    },
    { connectionId: null, title: "Distribuições", chartType: "divider", preset: "", refreshInterval: 0, position: { x: 0, y: 6, w: 12, h: 1 }, content: null },
    { connectionId: null, title: "Tickets por status", chartType: "donut", preset: "tickets_by_status", refreshInterval: 60, position: { x: 0, y: 7, w: 6, h: 4 }, content: null },
    { connectionId: null, title: "Tickets por prioridade", chartType: "donut", preset: "tickets_by_priority", refreshInterval: 60, position: { x: 6, y: 7, w: 6, h: 4 }, content: null },
    { connectionId: null, title: "Tickets por categoria", chartType: "bar", preset: "tickets_by_category", refreshInterval: 60, position: { x: 0, y: 11, w: 6, h: 4 }, content: null },
    { connectionId: null, title: "Tickets por técnico", chartType: "bar", preset: "tickets_by_technician", refreshInterval: 60, position: { x: 6, y: 11, w: 6, h: 4 }, content: null },
    { connectionId: null, title: "Evolução & SLA", chartType: "divider", preset: "", refreshInterval: 0, position: { x: 0, y: 15, w: 12, h: 1 }, content: null },
    { connectionId: null, title: "Evolução de tickets", chartType: "line", preset: "tickets_evolution", refreshInterval: 60, position: { x: 0, y: 16, w: 8, h: 4 }, content: null },
    { connectionId: null, title: "Cumprimento de SLA", chartType: "metric", preset: "sla_compliance", refreshInterval: 60, position: { x: 8, y: 16, w: 4, h: 4 }, content: null },
    { connectionId: null, title: "Detalhamento por status", chartType: "table", preset: "tickets_by_status", refreshInterval: 60, position: { x: 0, y: 20, w: 12, h: 5 }, content: null },
    {
      connectionId: null,
      title: "Como usar",
      chartType: "markdown",
      preset: "",
      refreshInterval: 0,
      position: { x: 0, y: 25, w: 12, h: 3 },
      content:
        "### Próximos passos\n\n1. Clique em **Editar dashboard** para reorganizar os blocos.\n2. Use **Adicionar widget** e escolha *Texto/Markdown* para criar seções com instruções, imagens ou links.\n3. Use *Divisória* para separar grupos de widgets.\n\n> Dica: imagens em markdown usam `![alt](url)` — qualquer URL pública funciona.",
    },
  ];

  for (const w of items) {
    await createWidget({ ...w, dashboardId: dash.id });
  }
  emit();
  return dash;
}

// ---------- Slideshows ----------
export type Slideshow = {
  id: string;
  orgId: string;
  name: string;
  defaultSeconds: number;
  createdAt: string;
};

export type SlideshowItem = {
  id: string;
  slideshowId: string;
  dashboardId: string;
  position: number;
  seconds: number;
};

function mapSlideshow(r: any): Slideshow {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    defaultSeconds: r.default_seconds,
    createdAt: r.created_at,
  };
}

function mapSlideshowItem(r: any): SlideshowItem {
  return {
    id: r.id,
    slideshowId: r.slideshow_id,
    dashboardId: r.dashboard_id,
    position: r.position,
    seconds: r.seconds,
  };
}

export async function listSlideshows(orgId: string): Promise<Slideshow[]> {
  const { data, error } = await supabase
    .from("slideshows")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSlideshow);
}

export async function getSlideshow(id: string): Promise<Slideshow | null> {
  const { data, error } = await supabase.from("slideshows").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSlideshow(data) : null;
}

export async function listSlideshowItems(slideshowId: string): Promise<SlideshowItem[]> {
  const { data, error } = await supabase
    .from("slideshow_items")
    .select("*")
    .eq("slideshow_id", slideshowId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSlideshowItem);
}

export async function createSlideshow(orgId: string, name: string, defaultSeconds = 30): Promise<Slideshow> {
  const { data, error } = await supabase
    .from("slideshows")
    .insert({ org_id: orgId, name, default_seconds: defaultSeconds })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit();
  return mapSlideshow(data);
}

export async function updateSlideshow(id: string, patch: Partial<Pick<Slideshow, "name" | "defaultSeconds">>) {
  const payload: any = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.defaultSeconds !== undefined) payload.default_seconds = patch.defaultSeconds;
  const { error } = await supabase.from("slideshows").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function deleteSlideshow(id: string) {
  const { error } = await supabase.from("slideshows").delete().eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function setSlideshowItems(
  slideshowId: string,
  items: Array<{ dashboardId: string; seconds: number }>,
) {
  const { error: delErr } = await supabase
    .from("slideshow_items")
    .delete()
    .eq("slideshow_id", slideshowId);
  if (delErr) throw new Error(delErr.message);
  if (items.length > 0) {
    const rows = items.map((it, i) => ({
      slideshow_id: slideshowId,
      dashboard_id: it.dashboardId,
      position: i,
      seconds: it.seconds,
    }));
    const { error: insErr } = await supabase.from("slideshow_items").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  emit();
}

// ---------- App settings (singleton) ----------
export async function getAppSettings(): Promise<{ systemName: string }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("system_name")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { systemName: (data?.system_name as string) ?? "DigitalDash" };
}

export async function updateAppSettings(systemName: string): Promise<void> {
  const trimmed = systemName.trim();
  if (!trimmed) throw new Error("Nome não pode ser vazio");
  if (trimmed.length > 60) throw new Error("Nome muito longo (máx 60)");
  const { error } = await supabase
    .from("app_settings")
    .update({ system_name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  emit();
}
