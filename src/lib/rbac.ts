// RBAC data layer — roles, groups, org_users
import { supabase } from "@/integrations/supabase/client";

export const SUPER_ADMIN_EMAIL = "contato@digitalideia.com.br";

// ---- Types ----

export type MenuKey =
  | "dashboards"
  | "tv"
  | "slideshow"
  | "connections"
  | "explorer"
  | "settings"
  | "ia";

export type MenuPermission = {
  view: boolean;
  create: boolean;
  edit: boolean;
};

export type RolePermissions = Record<MenuKey, MenuPermission>;

export const DEFAULT_PERMISSIONS: RolePermissions = {
  dashboards: { view: true, create: false, edit: false },
  tv: { view: true, create: false, edit: false },
  slideshow: { view: true, create: false, edit: false },
  connections: { view: false, create: false, edit: false },
  explorer: { view: false, create: false, edit: false },
  settings: { view: false, create: false, edit: false },
  ia: { view: false, create: false, edit: false },
};

export type Role = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  permissions: RolePermissions;
  createdAt: string;
};

export type Group = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type OrgUser = {
  id: string;
  orgId: string;
  userId: string;
  roleId: string | null;
  groupId: string | null;
  createdAt: string;
  // Joined fields
  userEmail?: string;
  userName?: string;
  roleName?: string;
  groupName?: string;
};

// ---- Roles ----

export async function listRoles(orgId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRole);
}

export async function createRole(
  orgId: string,
  name: string,
  description: string,
  permissions: RolePermissions,
): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .insert({ org_id: orgId, name, description, permissions })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRole(data);
}

export async function updateRole(
  id: string,
  patch: { name?: string; description?: string; permissions?: RolePermissions },
): Promise<Role> {
  const { data, error } = await supabase
    .from("roles")
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.permissions !== undefined && { permissions: patch.permissions }),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRole(data);
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRole(r: any): Role {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    description: r.description ?? null,
    permissions: (r.permissions as RolePermissions) ?? DEFAULT_PERMISSIONS,
    createdAt: r.created_at,
  };
}

// ---- Groups ----

export async function listGroups(orgId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapGroup);
}

export async function createGroup(
  orgId: string,
  name: string,
  description: string,
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ org_id: orgId, name, description })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapGroup(data);
}

export async function updateGroup(
  id: string,
  patch: { name?: string; description?: string },
): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapGroup(data);
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapGroup(g: any): Group {
  return {
    id: g.id,
    orgId: g.org_id,
    name: g.name,
    description: g.description ?? null,
    createdAt: g.created_at,
  };
}

// ---- Group Dashboards ----

export async function listGroupDashboards(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_dashboards")
    .select("dashboard_id")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.dashboard_id as string);
}

export async function setGroupDashboards(groupId: string, dashboardIds: string[]): Promise<void> {
  // Delete all existing then insert new ones
  const { error: delErr } = await supabase
    .from("group_dashboards")
    .delete()
    .eq("group_id", groupId);
  if (delErr) throw new Error(delErr.message);

  if (dashboardIds.length === 0) return;

  const rows = dashboardIds.map((did) => ({ group_id: groupId, dashboard_id: did }));
  const { error: insErr } = await supabase.from("group_dashboards").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

// ---- Org Users ----

export async function listOrgUsers(orgId: string): Promise<OrgUser[]> {
  // Step 1: fetch org_users with role/group names (these FKs are well-known)
  const { data: ouData, error: ouErr } = await supabase
    .from("org_users")
    .select(`id, org_id, user_id, role_id, group_id, created_at, roles(name), groups(name)`)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (ouErr) throw new Error(ouErr.message);
  if (!ouData || ouData.length === 0) return [];

  // Step 2: fetch profiles for those user_ids
  const userIds = ouData.map((r) => r.user_id as string);
  const { data: profData } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", userIds);

  const profMap: Record<string, { name: string; email: string }> = {};
  (profData ?? []).forEach((p: { id: string; name: string | null; email: string | null }) => {
    profMap[p.id] = { name: p.name ?? "", email: p.email ?? "" };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (ouData ?? []).map((r: any) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    roleId: r.role_id,
    groupId: r.group_id,
    createdAt: r.created_at,
    userName: profMap[r.user_id]?.name ?? "",
    userEmail: profMap[r.user_id]?.email ?? "",
    roleName: r.roles?.name ?? null,
    groupName: r.groups?.name ?? null,
  }));
}

export async function updateOrgUser(
  id: string,
  patch: { roleId?: string | null; groupId?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("org_users")
    .update({
      ...(patch.roleId !== undefined && { role_id: patch.roleId }),
      ...(patch.groupId !== undefined && { group_id: patch.groupId }),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteOrgUser(id: string): Promise<void> {
  const { error } = await supabase.from("org_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Invite User (via Edge Function) ----

export async function inviteUser(params: {
  name: string;
  email: string;
  password: string;
  orgId: string;
  roleId?: string | null;
  groupId?: string | null;
}): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão não encontrada");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      password: params.password,
      org_id: params.orgId,
      role_id: params.roleId ?? null,
      group_id: params.groupId ?? null,
    }),
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Erro ao convidar usuário");
}

// ---- User Permissions (for current user) ----

export async function loadMyPermissions(
  orgId: string,
): Promise<{ permissions: RolePermissions | null; groupId: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { permissions: null, groupId: null };

  // Super-admin always has full access
  if (user.email === SUPER_ADMIN_EMAIL) {
    const fullAccess: MenuPermission = { view: true, create: true, edit: true };
    return {
      permissions: {
        dashboards: fullAccess,
        tv: fullAccess,
        slideshow: fullAccess,
        connections: fullAccess,
        explorer: fullAccess,
        settings: fullAccess,
        ia: fullAccess,
      },
      groupId: null,
    };
  }

  const { data, error } = await supabase
    .from("org_users")
    .select("group_id, role_id, roles(permissions)")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return { permissions: null, groupId: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = (data as any)?.roles?.permissions as RolePermissions | null;
  return {
    permissions: perms ?? DEFAULT_PERMISSIONS,
    groupId: data.group_id as string | null,
  };
}

// Dashboards visible to the current user's group
export async function listMyGroupDashboardIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_dashboards")
    .select("dashboard_id")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.dashboard_id as string);
}
