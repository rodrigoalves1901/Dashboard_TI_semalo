import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FullscreenDashboard } from "@/components/FullscreenDashboard";

export const Route = createFileRoute("/_authenticated/app/tv/$id")({
  component: TvPlay,
});

const KEY = "flup.tvIntervalSeconds";

function TvPlay() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [interval, setIntervalSec] = useState(160);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = Number(window.localStorage.getItem(KEY));
      if (Number.isFinite(v) && v > 0) setIntervalSec(v);
    }
  }, []);

  return (
    <FullscreenDashboard
      dashboardId={id}
      intervalSeconds={interval}
      onExit={() => navigate({ to: "/app/tv" })}
    />
  );
}
