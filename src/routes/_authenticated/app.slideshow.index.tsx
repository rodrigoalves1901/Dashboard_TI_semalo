import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listSlideshows, deleteSlideshow, subscribe, type Slideshow } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { Plus, PlayCircle, Pencil, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/slideshow/")({
  component: SlideshowIndex,
});

function SlideshowIndex() {
  const { currentOrg } = useAuth();
  const [items, setItems] = useState<Slideshow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (!currentOrg) return;
      try {
        const list = await listSlideshows(currentOrg.id);
        if (!cancelled) setItems(list);
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void refresh();
    const unsub = subscribe(() => void refresh());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentOrg]);

  const remove = async (id: string) => {
    if (!confirm("Excluir esta playlist?")) return;
    try {
      await deleteSlideshow(id);
      toast.success("Playlist excluída");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Slideshow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie playlists de dashboards que se alternam em tela cheia.
          </p>
        </div>
        <Link
          to="/app/slideshow/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} /> Nova playlist
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma playlist ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <div key={s.id} className="rounded-[14px] border border-border bg-card p-5 shadow-card">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <PlayCircle size={18} />
              </div>
              <h3 className="mt-4 text-base font-bold">{s.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Tempo padrão: {s.defaultSeconds}s
              </p>
              <div className="mt-4 flex gap-2">
                <Link
                  to="/app/slideshow/$id/play"
                  params={{ id: s.id }}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <Play size={14} /> Reproduzir
                </Link>
                <Link
                  to="/app/slideshow/$id/edit"
                  params={{ id: s.id }}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary"
                >
                  <Pencil size={13} />
                </Link>
                <button
                  onClick={() => remove(s.id)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
