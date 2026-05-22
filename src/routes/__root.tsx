import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { AppSettingsProvider } from "@/hooks/use-app-settings";
import { PermissionsProvider } from "@/hooks/use-permissions";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DigitalDash — Dashboards multi-fonte" },
      {
        name: "description",
        content: "Crie dashboards conectando-se a vários sistemas como GLPI, MySQL e mais.",
      },
      { property: "og:title", content: "DigitalDash — Dashboards multi-fonte" },
      { name: "twitter:title", content: "DigitalDash — Dashboards multi-fonte" },
      {
        property: "og:description",
        content: "Crie dashboards conectando-se a vários sistemas como GLPI, MySQL e mais.",
      },
      {
        name: "twitter:description",
        content: "Crie dashboards conectando-se a vários sistemas como GLPI, MySQL e mais.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function NotFound() {
  return (
    <div style={{ padding: 32, fontFamily: "Inter, system-ui" }}>
      <h1>404 — Página não encontrada</h1>
      <Link to="/">Voltar ao início</Link>
    </div>
  );
}

function RootError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div style={{ padding: 32, fontFamily: "Inter, system-ui" }}>
      <h1>Algo deu errado</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{error.message}</pre>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionsProvider>
          <AppSettingsProvider>
            <Outlet />
            <Toaster />
          </AppSettingsProvider>
        </PermissionsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
