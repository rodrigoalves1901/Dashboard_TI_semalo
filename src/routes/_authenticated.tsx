import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { db } from "@/lib/storage";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = db.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
