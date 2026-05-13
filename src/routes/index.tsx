import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    navigate({ to: user ? "/app" : "/login", replace: true });
  }, [navigate, user, ready]);
  return null;
}
