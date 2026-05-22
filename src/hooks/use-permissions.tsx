import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  loadMyPermissions,
  SUPER_ADMIN_EMAIL,
  DEFAULT_PERMISSIONS,
  type MenuKey,
  type RolePermissions,
} from "@/lib/rbac";

type PermCtx = {
  permissions: RolePermissions;
  groupId: string | null;
  isSuperAdmin: boolean;
  ready: boolean;
  can: (menu: MenuKey, action: "view" | "create" | "edit") => boolean;
};

const Ctx = createContext<PermCtx | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, currentOrg } = useAuth();

  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user || !currentOrg) {
      setReady(true);
      return;
    }
    setReady(false);
    loadMyPermissions(currentOrg.id)
      .then(({ permissions: p, groupId: g }) => {
        if (p) setPermissions(p);
        setGroupId(g);
      })
      .catch(console.error)
      .finally(() => setReady(true));
  }, [user?.id, currentOrg?.id]);

  const can = (menu: MenuKey, action: "view" | "create" | "edit"): boolean => {
    if (isSuperAdmin) return true;
    return permissions[menu]?.[action] ?? false;
  };

  return (
    <Ctx.Provider value={{ permissions, groupId, isSuperAdmin, ready, can }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePermissions(): PermCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePermissions must be inside PermissionsProvider");
  return ctx;
}
