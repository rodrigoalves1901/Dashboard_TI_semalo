import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  DEFAULT_PERMISSIONS,
  type Role,
  type RolePermissions,
  type MenuKey,
} from "@/lib/rbac";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Eye,
  FilePlus,
  Edit3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/roles")({
  component: RolesPage,
});

const MENU_LABELS: Record<MenuKey, string> = {
  dashboards: "Dashboards",
  tv: "Modo TV",
  slideshow: "Slideshow",
  connections: "Conexões",
  explorer: "Explorer",
  settings: "Configurações",
  ia: "IA",
};

const MENUS = Object.keys(MENU_LABELS) as MenuKey[];

function RolesPage() {
  const { currentOrg } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate({ to: "/app" });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    listRoles(currentOrg.id)
      .then(setRoles)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [currentOrg?.id]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPerms(DEFAULT_PERMISSIONS);
    setShowForm(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setPerms(role.permissions);
    setShowForm(true);
  };

  const onSave = async () => {
    if (!currentOrg || !name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateRole(editing.id, { name, description, permissions: perms });
        setRoles((r) => r.map((x) => (x.id === updated.id ? updated : x)));
        toast.success("Perfil atualizado");
      } else {
        const created = await createRole(currentOrg.id, name, description, perms);
        setRoles((r) => [...r, created]);
        toast.success("Perfil criado");
      }
      setShowForm(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (role: Role) => {
    if (!confirm(`Excluir o perfil "${role.name}"?`)) return;
    try {
      await deleteRole(role.id);
      setRoles((r) => r.filter((x) => x.id !== role.id));
      toast.success("Perfil excluído");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const togglePerm = (menu: MenuKey, action: "view" | "create" | "edit") => {
    setPerms((p) => ({
      ...p,
      [menu]: { ...p[menu], [action]: !p[menu][action] },
    }));
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Perfis de Acesso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina quais menus e privilégios cada perfil possui.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus size={14} /> Novo Perfil
        </button>
      </header>

      {/* Form dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                <h2 className="font-bold">{editing ? "Editar Perfil" : "Novo Perfil"}</h2>
              </div>
              <button onClick={() => setShowForm(false)}>
                <X size={18} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Nome do perfil *
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  placeholder="Ex: Analista, Gestor, Viewer..."
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Descrição
                </span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  placeholder="Descrição opcional"
                />
              </label>

              {/* Permissions matrix */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Permissões por módulo
                </p>
                <div className="overflow-hidden rounded-lg border border-border">
                  {/* Header */}
                  <div className="grid grid-cols-4 border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Módulo</span>
                    <span className="flex items-center justify-center gap-1">
                      <Eye size={12} /> Ver
                    </span>
                    <span className="flex items-center justify-center gap-1">
                      <FilePlus size={12} /> Criar
                    </span>
                    <span className="flex items-center justify-center gap-1">
                      <Edit3 size={12} /> Editar
                    </span>
                  </div>
                  {MENUS.map((menu) => (
                    <div
                      key={menu}
                      className="grid grid-cols-4 items-center border-b border-border/50 px-4 py-3 last:border-0 hover:bg-secondary/20"
                    >
                      <span className="text-sm font-medium">{MENU_LABELS[menu]}</span>
                      {(["view", "create", "edit"] as const).map((action) => (
                        <div key={action} className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => togglePerm(menu, action)}
                            className={`h-5 w-5 rounded-md border-2 transition-colors ${
                              perms[menu][action]
                                ? "border-primary bg-primary"
                                : "border-border bg-transparent hover:border-primary/50"
                            }`}
                          >
                            {perms[menu][action] && (
                              <svg viewBox="0 0 12 12" fill="none" className="h-full w-full p-0.5">
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="white"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={onSave}
                disabled={saving || !name.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Save size={14} /> {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando perfis...</div>
      ) : roles.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border p-12 text-center">
          <ShieldCheck size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum perfil criado ainda.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={14} /> Criar primeiro perfil
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="rounded-[14px] border border-border bg-card shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{role.name}</p>
                    {role.description && (
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(expanded === role.id ? null : role.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                    title="Ver permissões"
                  >
                    {expanded === role.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    onClick={() => openEdit(role)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(role)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {expanded === role.id && (
                <div className="border-t border-border/50 px-5 pb-4">
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MENUS.map((menu) => {
                      const p = role.permissions[menu];
                      const actions = [
                        p.view && "Ver",
                        p.create && "Criar",
                        p.edit && "Editar",
                      ].filter(Boolean);
                      return (
                        <div
                          key={menu}
                          className={`rounded-lg border px-3 py-2 text-xs ${
                            actions.length > 0
                              ? "border-primary/20 bg-primary/5"
                              : "border-border bg-secondary/30 opacity-50"
                          }`}
                        >
                          <p className="font-semibold text-foreground">{MENU_LABELS[menu]}</p>
                          <p className="text-muted-foreground">
                            {actions.length > 0 ? actions.join(", ") : "Sem acesso"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
