import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — DigitalDash" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { signUp } = useAuth();
  const { systemName } = useAppSettings();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(name, email, password, orgName);
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-[14px] border border-border bg-card p-8 shadow-card">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">F</div>
          <span className="text-lg font-bold">{systemName}</span>
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight">Criar sua conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">Comece a montar dashboards em minutos.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Seu nome">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Nome da organização">
            <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input" />
          </Field>
          <Field label="Email">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </Field>
          <Field label="Senha">
            <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
      <style>{`.input{height:40px;width:100%;border-radius:8px;border:1px solid var(--border);background:var(--card);padding:0 12px;font-size:14px;color:var(--foreground);}.input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 4px color-mix(in oklch, var(--primary) 12%, transparent);}`}</style>
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
