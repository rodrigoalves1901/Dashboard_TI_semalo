// Supabase-backed data layer for orgs, connections, dashboards, widgets.
import { supabase } from "@/integrations/supabase/client";

export type Org = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
};

export type Connection = {
  id: string;
  orgId: string;
  name: string;
  systemType: "glpi";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  createdAt: string;
};

export type ChartType = "metric" | "bar" | "line" | "donut" | "table";

export type Dashboard = {
  id: string;
  orgId: string;
  name: string;
  description: string;
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
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("orgs")
    .insert({ name, owner_id: uid })
    .select("id,name,owner_id,created_at")
    .single();
  if (error) throw new Error(error.message);
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

export async function createWidget(input: Omit<Widget, "id">): Promise<Widget> {
  const { data, error } = await supabase
    .from("widgets")
    .insert({
      dashboard_id: input.dashboardId,
      connection_id: input.connectionId,
      title: input.title,
      chart_type: input.chartType,
      preset: input.preset,
      refresh_interval: input.refreshInterval,
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

function mapWidget(r: any): Widget {
  return {
    id: r.id,
    dashboardId: r.dashboard_id,
    connectionId: r.connection_id,
    title: r.title,
    chartType: r.chart_type,
    preset: r.preset,
    refreshInterval: r.refresh_interval,
  };
}
