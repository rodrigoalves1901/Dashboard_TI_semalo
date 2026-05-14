import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — DigitalDash" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuth();
  const { systemName } = useAppSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between bg-card border-r border-border p-10">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">F</div>
          <span className="text-lg font-bold">{systemName}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Conecte seus sistemas. Visualize tudo em um lugar.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Construa dashboards personalizados a partir do GLPI e outros bancos.
            Conexão segura por IP e porta, configurada em minutos.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">© {systemName}</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><LayoutDashboard size={16} /></div>
            <span className="text-lg font-bold">{systemName}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acesse seus dashboards.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
