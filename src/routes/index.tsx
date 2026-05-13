import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { db } from "@/lib/storage";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const session = db.getSession();
    navigate({ to: session ? "/app" : "/login", replace: true });
  }, [navigate]);
  return null;
}
