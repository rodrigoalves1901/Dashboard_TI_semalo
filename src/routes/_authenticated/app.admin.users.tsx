import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  listOrgUsers,
  updateOrgUser,
  deleteOrgUser,
  inviteUser,
  listRoles,
  listGroups,
  type OrgUser,
  type Role,
  type Group,
} from "@/lib/rbac";
import { toast } from "sonner";
import {
  UserPlus,
  Trash2,
  Pencil,
  X,
  Save,
  Mail,
  Key,
  User as UserIcon,
  ShieldCheck,
  Users,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const { currentOrg } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invPassword, setInvPassword] = useState("");
  const [invRole, setInvRole] = useState("");
  const [invGroup, setInvGroup] = useState("");
  const [inviting, setInviting] = useState(false);

  // Edit form
  const [editing, setEditing] = useState<OrgUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate({ to: "/app" });
    }
  }, [isSuperAdmin]);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [u, r, g] = await Promise.all([
        listOrgUsers(currentOrg.id),
        listRoles(currentOrg.id),
        listGroups(currentOrg.id),
      ]);
      setUsers(u);
      setRoles(r);
      setGroups(g);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentOrg?.id]);

  const onInvite = async () => {
    if (!currentOrg || !invName.trim() || !invEmail.trim() || invPassword.length < 6) return;
    setInviting(true);
    try {
      await inviteUser({
        name: invName,
        email: invEmail,
        password: invPassword,
        orgId: currentOrg.id,
        roleId: invRole || null,
        groupId: invGroup || null,
      });
      toast.success(`Usuário ${invEmail} criado com sucesso`);
      setShowInvite(false);
      setInvName("");
      setInvEmail("");
      setInvPassword("");
      setInvRole("");
      setInvGroup("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const openEdit = (u: OrgUser) => {
    setEditing(u);
    setEditRole(u.roleId ?? "");
    setEditGroup(u.groupId ?? "");
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await updateOrgUser(editing.id, {
        roleId: editRole || null,
        groupId: editGroup || null,
      });
      toast.success("Usuário atualizado");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const onDelete = async (u: OrgUser) => {
    if (!confirm(`Remover o usuário ${u.userEmail} da organização?`)) return;
    try {
      await deleteOrgUser(u.id);
      toast.success("Usuário removido");
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.userName?.toLowerCase().includes(search.toLowerCase()) ||
      u.userEmail?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os usuários desta organização, seus perfis e grupos.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <UserPlus size={14} /> Adicionar Usuário
        </button>
      </header>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[16px] border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                <h2 className="font-bold">Adicionar Usuário</h2>
              </div>
              <button onClick={() => setShowInvite(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <UserIcon size={12} /> Nome *
                </span>
                <input
                  autoFocus
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  placeholder="Nome completo"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Mail size={12} /> Email *
                </span>
                <input
                  type="email"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  placeholder="usuario@empresa.com"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Key size={12} /> Senha provisória *
                </span>
                <input
                  type="password"
                  value={invPassword}
                  onChange={(e) => setInvPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  placeholder="Mínimo 6 caracteres"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ShieldCheck size={12} /> Perfil
                  </span>
                  <select
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Sem perfil</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Users size={12} /> Grupo
                  </span>
                  <select
                    value={invGroup}
                    onChange={(e) => setInvGroup(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Sem grupo</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setShowInvite(false)}
                className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={onInvite}
                disabled={inviting || !invName.trim() || !invEmail.trim() || invPassword.length < 6}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <UserPlus size={14} /> {inviting ? "Criando..." : "Criar Usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit role/group modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-[16px] border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-bold">Editar Usuário</h2>
              <button onClick={() => setEditing(null)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <p className="text-sm font-semibold">{editing.userName}</p>
                <p className="text-xs text-muted-foreground">{editing.userEmail}</p>
              </div>
              <label className="block">
                <span className="mb-1.5 text-xs font-medium text-muted-foreground">Perfil</span>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Sem perfil</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 text-xs font-medium text-muted-foreground">Grupo</span>
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Sem grupo</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setEditing(null)}
                className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={onSaveEdit}
                disabled={editSaving}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Save size={14} /> {editSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {/* Users table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando usuários...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border p-12 text-center">
          <UserIcon size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {users.length === 0
              ? "Nenhum usuário adicionado ainda."
              : "Nenhum resultado encontrado."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-left">Usuário</th>
                <th className="px-5 py-3 text-left">Perfil</th>
                <th className="px-5 py-3 text-left">Grupo</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border/50 last:border-0 hover:bg-secondary/20"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                        {(u.userName || u.userEmail || "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{u.userName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.userEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {u.roleName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        <ShieldCheck size={10} /> {u.roleName}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {u.groupName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        <Users size={10} /> {u.groupName}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(u)}
                        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
