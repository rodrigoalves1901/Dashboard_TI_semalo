// Lightweight localStorage-backed data layer.
// Designed to be swapped for Supabase calls later without touching components.

export type User = {
  id: string;
  email: string;
  name: string;
  password: string; // mock only
};

export type Org = {
  id: string;
  name: string;
  ownerId: string;
};

export type Membership = {
  orgId: string;
  userId: string;
  role: "owner" | "admin" | "viewer";
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
  password: string; // would be encrypted server-side in real impl
  ssl: boolean;
  createdAt: string;
};

export type ChartType = "metric" | "bar" | "line" | "donut" | "table";

export type Widget = {
  id: string;
  dashboardId: string;
  connectionId: string | null;
  title: string;
  chartType: ChartType;
  // Builder config: pick a preset GLPI query
  preset: string; // e.g. "tickets_by_status"
  refreshInterval: number; // seconds
};

export type Dashboard = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  createdAt: string;
};

const KEYS = {
  users: "flup.users",
  session: "flup.session",
  orgs: "flup.orgs",
  memberships: "flup.memberships",
  currentOrg: "flup.currentOrg",
  connections: "flup.connections",
  dashboards: "flup.dashboards",
  widgets: "flup.widgets",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("flup:storage"));
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const db = {
  // users
  listUsers: () => read<User[]>(KEYS.users, []),
  saveUsers: (u: User[]) => write(KEYS.users, u),

  // session
  getSession: () => read<{ userId: string } | null>(KEYS.session, null),
  setSession: (s: { userId: string } | null) => write(KEYS.session, s),

  // orgs
  listOrgs: () => read<Org[]>(KEYS.orgs, []),
  saveOrgs: (o: Org[]) => write(KEYS.orgs, o),

  // memberships
  listMemberships: () => read<Membership[]>(KEYS.memberships, []),
  saveMemberships: (m: Membership[]) => write(KEYS.memberships, m),

  // current org
  getCurrentOrg: () => read<string | null>(KEYS.currentOrg, null),
  setCurrentOrg: (id: string | null) => write(KEYS.currentOrg, id),

  // connections
  listConnections: () => read<Connection[]>(KEYS.connections, []),
  saveConnections: (c: Connection[]) => write(KEYS.connections, c),

  // dashboards
  listDashboards: () => read<Dashboard[]>(KEYS.dashboards, []),
  saveDashboards: (d: Dashboard[]) => write(KEYS.dashboards, d),

  // widgets
  listWidgets: () => read<Widget[]>(KEYS.widgets, []),
  saveWidgets: (w: Widget[]) => write(KEYS.widgets, w),
};

export function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("flup:storage", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("flup:storage", handler);
    window.removeEventListener("storage", handler);
  };
}
