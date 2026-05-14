import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAppSettings, updateAppSettings, subscribe } from "@/lib/data";

type AppSettingsCtx = {
  systemName: string;
  ready: boolean;
  rename: (name: string) => Promise<void>;
};

const Ctx = createContext<AppSettingsCtx | null>(null);

const DEFAULT_NAME = "DigitalDash";

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [systemName, setSystemName] = useState<string>(DEFAULT_NAME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { systemName } = await getAppSettings();
        if (!cancelled) setSystemName(systemName || DEFAULT_NAME);
      } catch {
        // keep default if offline / table missing
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void load();
    const unsub = subscribe(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Keep document.title in sync (head() static title is overridden after mount)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const current = document.title;
    // Replace existing brand suffix if present, otherwise set base.
    if (current.includes("—")) {
      const prefix = current.split("—")[0].trim();
      document.title = `${prefix} — ${systemName}`;
    } else {
      document.title = systemName;
    }
  }, [systemName]);

  const rename = async (name: string) => {
    await updateAppSettings(name);
    setSystemName(name.trim());
  };

  return <Ctx.Provider value={{ systemName, ready, rename }}>{children}</Ctx.Provider>;
}

export function useAppSettings(): AppSettingsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return v;
}
