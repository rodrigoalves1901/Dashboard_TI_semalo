import { createFileRoute, redirect } from "@tanstack/react-router";
import { db } from "@/lib/storage";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = db.getSession();
    throw redirect({ to: session ? "/app" : "/login" });
  },
  component: () => null,
});
