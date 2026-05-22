import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSlideshow, listSlideshowItems, listDashboards, type Dashboard } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { SlideshowPlayer, type SlideshowEntry } from "@/components/SlideshowPlayer";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/slideshow/$id/play")({
  component: PlaySlideshow,
});

function PlaySlideshow() {
  const { id } = Route.useParams();
  const { currentOrg } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<SlideshowEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, items, dashboards] = await Promise.all([
          getSlideshow(id),
          listSlideshowItems(id),
          currentOrg ? listDashboards(currentOrg.id) : Promise.resolve([] as Dashboard[]),
        ]);
        if (cancelled) return;
        if (!s) {
          toast.error("Playlist não encontrada");
          navigate({ to: "/app/slideshow" });
          return;
        }
        const map = new Map(dashboards.map((d) => [d.id, d]));
        const built: SlideshowEntry[] = items
          .map((it) => {
            const d = map.get(it.dashboardId);
            return d ? { dashboard: d, seconds: it.seconds } : null;
          })
          .filter((x): x is SlideshowEntry => x !== null);
        setEntries(built);
      } catch (err) {
        toast.error((err as Error).message);
        navigate({ to: "/app/slideshow" });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, currentOrg, navigate]);

  if (!entries) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return <SlideshowPlayer entries={entries} onExit={() => navigate({ to: "/app/slideshow" })} />;
}
