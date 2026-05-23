import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  listDashboards,
  createSlideshow,
  updateSlideshow,
  setSlideshowItems,
  getSlideshow,
  listSlideshowItems,
  type Dashboard,
} from "@/lib/data";
import { listGroups, type Group } from "@/lib/rbac";
import { useAuth } from "@/hooks/use-auth";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Entry = { dashboardId: string; seconds: number };

type Props = { slideshowId?: string };

export function SlideshowEditor({ slideshowId }: Props) {
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [defaultSeconds, setDefaultSeconds] = useState(30);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentOrg) return;
      try {
        const [ds, grps] = await Promise.all([
          listDashboards(currentOrg.id),
          listGroups(currentOrg.id),
        ]);
        if (cancelled) return;
        setDashboards(ds);
        setGroups(grps);
        if (slideshowId) {
          const [s, items] = await Promise.all([
            getSlideshow(slideshowId),
            listSlideshowItems(slideshowId),
          ]);
          if (cancelled) return;
          if (s) {
            setName(s.name);
            setDefaultSeconds(s.defaultSeconds);
            setGroupId(s.groupId || "");
          }
          setEntries(items.map((it) => ({ dashboardId: it.dashboardId, seconds: it.seconds })));
        } else {
          setName("Nova playlist");
        }
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [currentOrg, slideshowId]);

  const addDashboard = (id: string) => {
    if (!id) return;
    setEntries((e) => [...e, { dashboardId: id, seconds: defaultSeconds }]);
  };

  const move = (i: number, dir: -1 | 1) => {
    setEntries((e) => {
      const next = [...e];
      const j = i + dir;
      if (j < 0 || j >= next.length) return e;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => setEntries((e) => e.filter((_, idx) => idx !== i));

  const setSeconds = (i: number, s: number) =>
    setEntries((e) => e.map((it, idx) => (idx === i ? { ...it, seconds: s } : it)));

  const save = async () => {
    if (!currentOrg) return;
    if (!name.trim()) {
      toast.error("Dê um nome à playlist");
      return;
    }
    setSaving(true);
    try {
      let id = slideshowId;
      if (id) {
        await updateSlideshow(id, { name: name.trim(), defaultSeconds, groupId: groupId || null });
      } else {
        const s = await createSlideshow(
          currentOrg.id,
          name.trim(),
          defaultSeconds,
          groupId || null,
        );
        id = s.id;
      }
      await setSlideshowItems(id, entries);
      toast.success("Playlist salva");
      navigate({ to: "/app/slideshow" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const dashMap = new Map(dashboards.map((d) => [d.id, d]));

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {slideshowId ? "Editar playlist" : "Nova playlist"}
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Grupo de Acesso (Opcional)
          </span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          >
            <option value="">Sem grupo (visível para todos)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Tempo padrão (s)
          </span>
          <input
            type="number"
            min={5}
            max={3600}
            value={defaultSeconds}
            onChange={(e) => setDefaultSeconds(Math.max(5, Number(e.target.value) || 5))}
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Dashboards na playlist ({entries.length})</h2>
          <select
            onChange={(e) => {
              addDashboard(e.target.value);
              e.target.value = "";
            }}
            value=""
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">+ Adicionar dashboard...</option>
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Adicione dashboards para compor o slideshow.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((it, i) => {
              const d = dashMap.get(it.dashboardId);
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {d?.name ?? "(dashboard removido)"}
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="number"
                      min={5}
                      max={3600}
                      value={it.seconds}
                      onChange={(e) => setSeconds(i, Math.max(5, Number(e.target.value) || 5))}
                      className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm"
                    />
                    s
                  </label>
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Mover para cima"
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === entries.length - 1}
                    aria-label="Mover para baixo"
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    aria-label="Remover"
                    className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Plus size={14} /> {saving ? "Salvando..." : "Salvar playlist"}
        </button>
        <button
          onClick={() => navigate({ to: "/app/slideshow" })}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
