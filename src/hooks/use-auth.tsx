import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db, subscribe, uid, type Org } from "@/lib/storage";
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

  const refreshOrgs = (uid_: string | null) => {
    if (!uid_) {
      setOrgs([]);
      setCurrentOrg(null);
      return;
    }
    const myOrgIds = db.listMemberships().filter((m) => m.userId === uid_).map((m) => m.orgId);
    const allOrgs = db.listOrgs().filter((o) => myOrgIds.includes(o.id));
    setOrgs(allOrgs);
    const currentId = db.getCurrentOrg();
    const cur = allOrgs.find((o) => o.id === currentId) ?? allOrgs[0] ?? null;
    setCurrentOrg(cur);
    if (cur && cur.id !== currentId) db.setCurrentOrg(cur.id);
  };

  const applySession = (session: Session | null) => {
    const u = toAuthUser(session?.user ?? null);
    setUser(u);
    refreshOrgs(u?.id ?? null);
    setReady(true);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const unsub = subscribe(() => refreshOrgs(user?.id ?? null));
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
    const newUserId = data.user?.id;
    if (newUserId) {
      const newOrg: Org = { id: uid(), name: orgName, ownerId: newUserId };
      db.saveOrgs([...db.listOrgs(), newOrg]);
      db.saveMemberships([
        ...db.listMemberships(),
        { orgId: newOrg.id, userId: newUserId, role: "owner" },
      ]);
      db.setCurrentOrg(newOrg.id);
    }
  };

  const signOut = async () => {
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
    db.setCurrentOrg(orgId);
    refreshOrgs(user?.id ?? null);
  };

  return (
    <Ctx.Provider
      value={{ user, orgs, currentOrg, ready, signIn, signUp, signOut, resetPassword, switchOrg }}
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
