// Supabase-backed data layer for orgs, connections, dashboards, widgets.
import { supabase } from "@/integrations/supabase/client";
import { createOrgOnServer } from "@/lib/orgs.functions";
import type { AlertRule } from "@/lib/alert-rule";
import type { DrilldownConfig } from "@/lib/drilldown";
import { SUPER_ADMIN_EMAIL } from "@/lib/rbac";

export type Org = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
};

export type SystemType =
  | "mysql"
  | "mariadb"
  | "sqlserver"
  | "sharepoint"
  | "msgraph_licenses"
  | "bigquery"
  | "demo";

export type Connection = {
  id: string;
  orgId: string;
  name: string;
  systemType: SystemType;
  // For DBs (mysql/mariadb/sqlserver): host/port/database/username/password
  // For SharePoint: host=tenantId, database=siteUrl (e.g. contoso.sharepoint.com:/sites/Marketing),
  //                 username=clientId, password=clientSecret, port=443
  // For BigQuery: host=dataset (optional), database=projectId,
  //               password=JSON key (service account JSON string), port=443
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  createdAt: string;
};

export type ChartType =
  | "metric"
  | "bar"
  | "line"
  | "donut"
  | "table"
  | "markdown"
  | "divider"
  | "composed";

export type Dashboard = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  createdAt: string;
};

export type WidgetPosition = { x: number; y: number; w: number; h: number };

export type WidgetStyles = {
  titleSize?: number;
  titleBold?: boolean;
  titleColor?: string;
  centerTitle?: boolean;
  centerValue?: boolean;
  showValues?: boolean;
  seriesMapping?: Record<
    string,
    { label?: string; color?: string; hidden?: boolean; showInFooter?: boolean }
  >;
  barSize?: number;
  barCategoryGap?: number;
  disableAnimations?: boolean;
  rotateLabels?: boolean;
};

export type CustomMetric = {
  id: string;
  orgId: string;
  connectionId: string | null;
  name: string;
  sqlQuery: string;
  category: string;
  createdAt: string;
};

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
  /** Visual customizations. */
  styles: WidgetStyles;
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

export async function createConnection(
  input: Omit<Connection, "id" | "createdAt">,
): Promise<Connection> {
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

export async function getConnection(id: string): Promise<Connection | null> {
  const { data, error } = await supabase.from("connections").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapConnection(data) : null;
}

export async function updateConnection(
  id: string,
  input: Partial<Omit<Connection, "id" | "createdAt">>,
): Promise<void> {
  const payload: any = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.systemType !== undefined) payload.system_type = input.systemType;
  if (input.host !== undefined) payload.host = input.host;
  if (input.port !== undefined) payload.port = input.port;
  if (input.database !== undefined) payload.database = input.database;
  if (input.username !== undefined) payload.username = input.username;
  if (input.password !== undefined) payload.password = input.password;
  if (input.ssl !== undefined) payload.ssl = input.ssl;

  const { error } = await supabase.from("connections").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
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

export async function listDashboards(orgId: string): Promise<Dashboard[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  if (user.email === SUPER_ADMIN_EMAIL) {
    const { data, error } = await supabase
      .from("dashboards")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapDashboard);
  }

  // Get user's organization membership to find group_id
  const { data: member, error: memberErr } = await supabase
    .from("org_users")
    .select("group_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr || !member || !member.group_id) {
    return []; // No group assigned = no dashboards visible
  }

  // Get dashboards mapped to this group
  const { data: groupDashes, error: gdErr } = await supabase
    .from("group_dashboards")
    .select("dashboard_id")
    .eq("group_id", member.group_id);

  if (gdErr || !groupDashes || groupDashes.length === 0) {
    return [];
  }

  const dashIds = groupDashes.map((gd) => gd.dashboard_id);

  const { data, error } = await supabase
    .from("dashboards")
    .select("*")
    .eq("org_id", orgId)
    .in("id", dashIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapDashboard);
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("dashboards").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;

  if (user.email === SUPER_ADMIN_EMAIL) {
    return mapDashboard(data);
  }

  // Check if user is member of the dashboard's org and what group they are in
  const { data: member } = await supabase
    .from("org_users")
    .select("group_id")
    .eq("org_id", data.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member || !member.group_id) return null;

  // Check if this dashboard is in the user's group
  const { data: hasAccess } = await supabase
    .from("group_dashboards")
    .select("dashboard_id")
    .eq("group_id", member.group_id)
    .eq("dashboard_id", id)
    .maybeSingle();

  if (!hasAccess) return null;

  return mapDashboard(data);
}

export async function createDashboard(
  orgId: string,
  name: string,
  description = "",
): Promise<Dashboard> {
  const { data, error } = await supabase
    .from("dashboards")
    .insert({ org_id: orgId, name, description })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit();
  return mapDashboard(data);
}

export async function updateDashboard(
  id: string,
  patch: Partial<Pick<Dashboard, "name" | "description">>,
) {
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
  input: Omit<Widget, "id" | "valueScale" | "alertRule" | "drilldown" | "styles"> & {
    valueScale?: number;
    alertRule?: AlertRule;
    drilldown?: DrilldownConfig;
    styles?: WidgetStyles;
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
      styles: input.styles ?? {},
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
  const { error } = await supabase.from("widgets").update({ position }).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetValueScale(id: string, valueScale: number) {
  const clamped = Math.min(6, Math.max(0.5, Math.round(valueScale * 100) / 100));
  const { error } = await supabase.from("widgets").update({ value_scale: clamped }).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetAlertRule(id: string, rule: AlertRule) {
  const { error } = await supabase.from("widgets").update({ alert_rule: rule }).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetDrilldown(id: string, drilldown: DrilldownConfig) {
  const { error } = await supabase.from("widgets").update({ drilldown }).eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidget(id: string, patch: Partial<Omit<Widget, "id" | "dashboardId">>) {
  const { error } = await supabase
    .from("widgets")
    .update({
      title: patch.title,
      chart_type: patch.chartType,
      connection_id: patch.connectionId,
      preset: patch.preset,
      content: patch.content,
      value_scale: patch.valueScale,
      refresh_interval: patch.refreshInterval,
      alert_rule: patch.alertRule,
      drilldown: patch.drilldown,
      styles: patch.styles,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

export async function updateWidgetStyles(id: string, styles: WidgetStyles) {
  const { error } = await supabase.from("widgets").update({ styles }).eq("id", id);
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
    styles: (r.styles as WidgetStyles) ?? {},
  };
}

// ---------- Sample dashboard ----------
export async function createSampleDashboard(orgId: string): Promise<Dashboard> {
  const dash = await createDashboard(
    orgId,
    "Modelo — Todos os widgets",
    "Dashboard de referência com exemplos de cada tipo de widget, incluindo cards de texto/markdown e divisórias.",
  );

  const items: Array<
    Omit<Widget, "id" | "dashboardId" | "valueScale" | "alertRule" | "drilldown" | "styles"> & {
      valueScale?: number;
      alertRule?: AlertRule;
      drilldown?: DrilldownConfig;
      styles?: WidgetStyles;
    }
  > = [
    {
      connectionId: null,
      title: "Visão geral",
      chartType: "divider",
      preset: "",
      refreshInterval: 0,
      position: { x: 0, y: 0, w: 12, h: 1 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets em aberto",
      chartType: "metric",
      preset: "tickets_open",
      refreshInterval: 60,
      position: { x: 0, y: 1, w: 3, h: 2 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets resolvidos",
      chartType: "metric",
      preset: "tickets_solved",
      refreshInterval: 60,
      position: { x: 3, y: 1, w: 3, h: 2 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets pendentes",
      chartType: "metric",
      preset: "tickets_pending",
      refreshInterval: 60,
      position: { x: 6, y: 1, w: 3, h: 2 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets atrasados",
      chartType: "metric",
      preset: "tickets_late",
      refreshInterval: 60,
      position: { x: 9, y: 1, w: 3, h: 2 },
      content: null,
    },
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
    {
      connectionId: null,
      title: "Distribuições",
      chartType: "divider",
      preset: "",
      refreshInterval: 0,
      position: { x: 0, y: 6, w: 12, h: 1 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets por status",
      chartType: "donut",
      preset: "tickets_by_status",
      refreshInterval: 60,
      position: { x: 0, y: 7, w: 6, h: 4 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets por prioridade",
      chartType: "donut",
      preset: "tickets_by_priority",
      refreshInterval: 60,
      position: { x: 6, y: 7, w: 6, h: 4 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets por categoria",
      chartType: "bar",
      preset: "tickets_by_category",
      refreshInterval: 60,
      position: { x: 0, y: 11, w: 6, h: 4 },
      content: null,
    },
    {
      connectionId: null,
      title: "Tickets por técnico",
      chartType: "bar",
      preset: "tickets_by_technician",
      refreshInterval: 60,
      position: { x: 6, y: 11, w: 6, h: 4 },
      content: null,
    },
    {
      connectionId: null,
      title: "Evolução & SLA",
      chartType: "divider",
      preset: "",
      refreshInterval: 0,
      position: { x: 0, y: 15, w: 12, h: 1 },
      content: null,
    },
    {
      connectionId: null,
      title: "Evolução de tickets",
      chartType: "line",
      preset: "tickets_evolution",
      refreshInterval: 60,
      position: { x: 0, y: 16, w: 8, h: 4 },
      content: null,
    },
    {
      connectionId: null,
      title: "Cumprimento de SLA",
      chartType: "metric",
      preset: "sla_compliance",
      refreshInterval: 60,
      position: { x: 8, y: 16, w: 4, h: 4 },
      content: null,
    },
    {
      connectionId: null,
      title: "Detalhamento por status",
      chartType: "table",
      preset: "tickets_by_status",
      refreshInterval: 60,
      position: { x: 0, y: 20, w: 12, h: 5 },
      content: null,
    },
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
  groupId: string | null;
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
    groupId: r.group_id ?? null,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  if (user.email === SUPER_ADMIN_EMAIL) {
    const { data, error } = await supabase
      .from("slideshows")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSlideshow);
  }

  const { data: member } = await supabase
    .from("org_users")
    .select("group_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return [];

  if (!member.group_id) {
    // User has no group: show only public playlists (where group_id is null)
    const { data, error } = await supabase
      .from("slideshows")
      .select("*")
      .eq("org_id", orgId)
      .is("group_id", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSlideshow);
  }

  // User belongs to a group: show public playlists OR those matching their group_id
  const { data, error } = await supabase
    .from("slideshows")
    .select("*")
    .eq("org_id", orgId)
    .or(`group_id.is.null,group_id.eq.${member.group_id}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSlideshow);
}

export async function getSlideshow(id: string): Promise<Slideshow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("slideshows").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;

  if (user.email === SUPER_ADMIN_EMAIL) {
    return mapSlideshow(data);
  }

  const { data: member } = await supabase
    .from("org_users")
    .select("group_id")
    .eq("org_id", data.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return null;

  // If the slideshow is public (no group_id), any organization member can access it
  if (!data.group_id) {
    return mapSlideshow(data);
  }

  // If slideshow is group-restricted, user must belong to that group
  if (member.group_id !== data.group_id) return null;

  return mapSlideshow(data);
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

export async function createSlideshow(
  orgId: string,
  name: string,
  defaultSeconds = 30,
  groupId: string | null = null,
): Promise<Slideshow> {
  const { data, error } = await supabase
    .from("slideshows")
    .insert({ org_id: orgId, name, default_seconds: defaultSeconds, group_id: groupId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  emit();
  return mapSlideshow(data);
}

export async function updateSlideshow(
  id: string,
  patch: Partial<Pick<Slideshow, "name" | "defaultSeconds" | "groupId">>,
) {
  const payload: any = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.defaultSeconds !== undefined) payload.default_seconds = patch.defaultSeconds;
  if (patch.groupId !== undefined) payload.group_id = patch.groupId;
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

// ---------- Custom Metrics ----------
export async function listCustomMetrics(orgId: string): Promise<CustomMetric[]> {
  const { data, error } = await supabase
    .from("custom_metrics")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map((m) => ({
    id: m.id,
    orgId: m.org_id,
    connectionId: m.connection_id,
    name: m.name,
    sqlQuery: m.sql_query,
    category: m.category,
    createdAt: m.created_at,
  }));
}

export async function createCustomMetric(
  metric: Omit<CustomMetric, "id" | "createdAt">,
): Promise<void> {
  const { error } = await supabase.from("custom_metrics").insert({
    org_id: metric.orgId,
    connection_id: metric.connectionId,
    name: metric.name,
    sql_query: metric.sqlQuery,
    category: metric.category,
  });

  if (error) throw new Error(error.message);
  emit();
}

export async function deleteCustomMetric(id: string): Promise<void> {
  const { error } = await supabase.from("custom_metrics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  emit();
}

// ---------- AI Config ----------

export type AIProvider = "gemini" | "openai" | "claude";

export type AIConfig = {
  id: string;
  orgId: string;
  provider: AIProvider;
  apiKey: string;
  model: string;
  enabled: boolean;
  scheduleTimes: string[]; // ["08:00", "18:00"]
  selectedWidgetIds: string[]; // widget IDs to be read aloud
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  customPrompt?: string;
  onlyCharts?: boolean;
};

function mapAIConfig(r: Record<string, unknown>): AIConfig {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    provider: (r.provider as AIProvider) ?? "gemini",
    apiKey: (r.api_key as string) ?? "",
    model: (r.model as string) ?? "",
    enabled: (r.enabled as boolean) ?? false,
    scheduleTimes: (r.schedule_times as string[]) ?? [],
    selectedWidgetIds: (r.selected_widget_ids as string[]) ?? [],
    ttsVoice: (r.tts_voice as string) ?? "",
    ttsRate: (r.tts_rate as number) ?? 1.0,
    ttsPitch: (r.tts_pitch as number) ?? 1.0,
    customPrompt: (r.custom_prompt as string) ?? "",
    onlyCharts: (r.only_charts as boolean) ?? false,
  };
}

export async function getAIConfig(orgId: string): Promise<AIConfig | null> {
  const { data, error } = await supabase
    .from("ai_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapAIConfig(data as Record<string, unknown>);
}

export async function upsertAIConfig(
  orgId: string,
  patch: Partial<Omit<AIConfig, "id" | "orgId">>,
): Promise<AIConfig> {
  const payload: Record<string, unknown> = { org_id: orgId };
  if (patch.provider !== undefined) payload.provider = patch.provider;
  if (patch.apiKey !== undefined) payload.api_key = patch.apiKey;
  if (patch.model !== undefined) payload.model = patch.model;
  if (patch.enabled !== undefined) payload.enabled = patch.enabled;
  if (patch.scheduleTimes !== undefined) payload.schedule_times = patch.scheduleTimes;
  if (patch.selectedWidgetIds !== undefined) payload.selected_widget_ids = patch.selectedWidgetIds;
  if (patch.ttsVoice !== undefined) payload.tts_voice = patch.ttsVoice;
  if (patch.ttsRate !== undefined) payload.tts_rate = patch.ttsRate;
  if (patch.ttsPitch !== undefined) payload.tts_pitch = patch.ttsPitch;
  if (patch.customPrompt !== undefined) payload.custom_prompt = patch.customPrompt;
  if (patch.onlyCharts !== undefined) payload.only_charts = patch.onlyCharts;

  const { data, error } = await supabase
    .from("ai_configs")
    .upsert(payload, { onConflict: "org_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapAIConfig(data as Record<string, unknown>);
}
