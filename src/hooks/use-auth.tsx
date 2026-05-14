import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyOrgs,
  createOrg,
  getCurrentOrgId,
  setCurrentOrgId,
  subscribe,
  type Org,
} from "@/lib/data";
import type { Session, User as SbUser } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

type AuthCtx = {
  user: AuthUser | null;
  currentOrg: Org | null;
  orgs: Org[];
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, orgName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function toAuthUser(u: SbUser | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.name as string) ?? u.email?.split("@")[0] ?? "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Org | null>(null);
  const [ready, setReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const reloadOrgs = async (uid: string | null) => {
    if (!uid) {
      setOrgs([]);
      setCurrentOrg(null);
      return;
    }
    try {
      const list = await listMyOrgs();
      setOrgs(list);
      const wanted = getCurrentOrgId();
      const cur = list.find((o) => o.id === wanted) ?? list[0] ?? null;
      setCurrentOrg(cur);
      if (cur && cur.id !== wanted) setCurrentOrgId(cur.id);
    } catch (err) {
      console.error("Failed to load orgs", err);
      setOrgs([]);
      setCurrentOrg(null);
    }
  };

  const applySession = async (session: Session | null) => {
    let validUser: SbUser | null = session?.user ?? null;
    if (validUser) {
      // Valida o token contra o servidor — se o usuário foi deletado, limpa a sessão.
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        validUser = null;
      } else {
        validUser = data.user;
      }
    }
    const u = toAuthUser(validUser);
    userIdRef.current = u?.id ?? null;
    setUser(u);
    await reloadOrgs(u?.id ?? null);
    setReady(true);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });
    supabase.auth.getSession().then(({ data }) => void applySession(data.session));
    const unsub = subscribe(() => {
      void reloadOrgs(userIdRef.current);
    });
    return () => {
      sub.subscription.unsubscribe();
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateError(error.message));
  };

  const signUp = async (name: string, email: string, password: string, orgName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) throw new Error(translateError(error.message));
    if (!data.session) {
      // Email confirmation required — can't create org until confirmed.
      return;
    }
    // Session active: create the org via Supabase (RLS allows owner_id = auth.uid()).
    try {
      const org = await createOrg(orgName);
      setCurrentOrgId(org.id);
      await reloadOrgs(data.user?.id ?? null);
    } catch (err) {
      console.error("Failed to create org on signup", err);
    }
  };

  const signOut = async () => {
    setCurrentOrgId(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    if (error) throw new Error(translateError(error.message));
  };

  const switchOrg = (orgId: string) => {
    setCurrentOrgId(orgId);
    const cur = orgs.find((o) => o.id === orgId) ?? null;
    setCurrentOrg(cur);
  };

  const refreshOrgs = async () => {
    await reloadOrgs(user?.id ?? null);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        orgs,
        currentOrg,
        ready,
        signIn,
        signUp,
        signOut,
        resetPassword,
        switchOrg,
        refreshOrgs,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

function translateError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email ou senha inválidos";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este email já está em uso";
  if (m.includes("email not confirmed")) return "Confirme seu email antes de entrar";
  if (m.includes("password should be at least"))
    return "A senha deve ter pelo menos 6 caracteres";
  return msg;
}
