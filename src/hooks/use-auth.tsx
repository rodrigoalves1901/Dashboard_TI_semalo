import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { db, subscribe, uid, type Org, type User } from "@/lib/storage";

type AuthCtx = {
  user: User | null;
  currentOrg: Org | null;
  orgs: Org[];
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, orgName: string) => Promise<void>;
  signOut: () => void;
  switchOrg: (orgId: string) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Org | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = () => {
    const session = db.getSession();
    const users = db.listUsers();
    const u = session ? users.find((x) => x.id === session.userId) ?? null : null;
    setUser(u);

    if (u) {
      const myOrgIds = db.listMemberships().filter((m) => m.userId === u.id).map((m) => m.orgId);
      const allOrgs = db.listOrgs().filter((o) => myOrgIds.includes(o.id));
      setOrgs(allOrgs);
      const currentId = db.getCurrentOrg();
      const cur = allOrgs.find((o) => o.id === currentId) ?? allOrgs[0] ?? null;
      setCurrentOrg(cur);
      if (cur && cur.id !== currentId) db.setCurrentOrg(cur.id);
    } else {
      setOrgs([]);
      setCurrentOrg(null);
    }
    setReady(true);
  };

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, []);

  const signIn = async (email: string, password: string) => {
    const users = db.listUsers();
    const u = users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) throw new Error("Email ou senha inválidos");
    db.setSession({ userId: u.id });
  };

  const signUp = async (name: string, email: string, password: string, orgName: string) => {
    const users = db.listUsers();
    if (users.some((x) => x.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Este email já está em uso");
    }
    const newUser: User = { id: uid(), name, email, password };
    db.saveUsers([...users, newUser]);

    const newOrg: Org = { id: uid(), name: orgName, ownerId: newUser.id };
    db.saveOrgs([...db.listOrgs(), newOrg]);
    db.saveMemberships([
      ...db.listMemberships(),
      { orgId: newOrg.id, userId: newUser.id, role: "owner" },
    ]);
    db.setCurrentOrg(newOrg.id);
    db.setSession({ userId: newUser.id });
  };

  const signOut = () => {
    db.setSession(null);
  };

  const switchOrg = (orgId: string) => {
    db.setCurrentOrg(orgId);
  };

  return (
    <Ctx.Provider value={{ user, orgs, currentOrg, ready, signIn, signUp, signOut, switchOrg }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
