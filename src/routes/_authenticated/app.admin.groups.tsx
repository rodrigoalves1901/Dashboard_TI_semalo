import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroupDashboards,
  setGroupDashboards,
  type Group,
} from "@/lib/rbac";
import { listDashboards, type Dashboard } from "@/lib/data";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, X, Save, LayoutDashboard, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/admin/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const { currentOrg } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Dashboard count per group
  const [groupDashCounts, setGroupDashCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate({ to: "/app" });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    Promise.all([listGroups(currentOrg.id), listDashboards(currentOrg.id)])
      .then(([grps, dashs]) => {
        setGroups(grps);
        setDashboards(dashs);
        // Load dashboard counts for each group
        return Promise.all(
          grps.map(async (g) => {
            const ids = await listGroupDashboards(g.id);
            return { id: g.id, count: ids.length };
          }),
        );
      })
      .then((counts) => {
        const map: Record<string, number> = {};
        counts.forEach((c) => (map[c.id] = c.count));
        setGroupDashCounts(map);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [currentOrg?.id]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSelectedDashboards([]);
    setShowForm(true);
  };

  const openEdit = async (group: Group) => {
    setEditing(group);
    setName(group.name);
    setDescription(group.description ?? "");
    const ids = await listGroupDashboards(group.id);
    setSelectedDashboards(ids);
    setShowForm(true);
  };

  const toggleDashboard = (id: string) => {
    setSelectedDashboards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onSave = async () => {
    if (!currentOrg || !name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateGroup(editing.id, { name, description });
        await setGroupDashboards(editing.id, selectedDashboards);
        setGroups((g) => g.map((x) => (x.id === updated.id ? updated : x)));
        setGroupDashCounts((c) => ({ ...c, [updated.id]: selectedDashboards.length }));
        toast.success("Grupo atualizado");
      } else {
        const created = await createGroup(currentOrg.id, name, description);
        await setGroupDashboards(created.id, selectedDashboards);
        setGroups((g) => [...g, created]);
        setGroupDashCounts((c) => ({ ...c, [created.id]: selectedDashboards.length }));
        toast.success("Grupo criado");
      }
      setShowForm(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (group: Group) => {
    if (!confirm(`Excluir o grupo "${group.name}"?`)) return;
    try {
      await deleteGroup(group.id);
      setGroups((g) => g.filter((x) => x.id !== group.id));
      toast.success("Grupo excluído");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grupos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Departamentos que têm acesso a dashboards específicos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus size={14} /> Novo Grupo
        </button>
      </header>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                <h2 className="font-bold">{editing ? "Editar Grupo" : "Novo Grupo"}</h2>
              </div>
              <button onClick={() => setShowForm(false)}>
                <X size={18} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Nome do grupo *
                </span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  placeholder="Ex: TI, Financeiro, Comercial..."
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

              {/* Dashboard selector */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Dashboards acessíveis por este grupo
                </p>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
                  {dashboards.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground">
                      Nenhum dashboard disponível
                    </p>
                  ) : (
                    dashboards.map((d) => {
                      const selected = selectedDashboards.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleDashboard(d.id)}
                          className={cn(
                            "flex w-full items-center gap-3 border-b border-border/50 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-secondary/40",
                            selected && "bg-primary/5",
                          )}
                        >
                          <div
                            className={cn(
                              "grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border",
                            )}
                          >
                            {selected && <Check size={12} />}
                          </div>
                          <div className="flex items-center gap-2">
                            <LayoutDashboard size={14} className="text-muted-foreground" />
                            <span className="font-medium">{d.name}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {selectedDashboards.length} dashboard(s) selecionado(s)
                </p>
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

      {/* Groups list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando grupos...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border p-12 text-center">
          <Users size={32} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum grupo criado ainda.</p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={14} /> Criar primeiro grupo
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-start justify-between rounded-[14px] border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Users size={16} />
                </div>
                <div>
                  <p className="font-semibold">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <LayoutDashboard size={11} />
                    {groupDashCounts[group.id] ?? 0} dashboard(s)
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(group)}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDelete(group)}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
