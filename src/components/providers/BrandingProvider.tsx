import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/services/settings.service";
import type { Settings } from "@/lib/types";

interface BrandingCtx {
  settings: Settings | undefined;
  loading: boolean;
}
const Ctx = createContext<BrandingCtx>({ settings: undefined, loading: true });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  useEffect(() => {
    if (!q.data) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", q.data.primary);
    root.style.setProperty("--accent", q.data.accent);
    root.style.setProperty("--ring", q.data.primary);
    if (q.data.background) {
      root.style.setProperty("--background", q.data.background);
    }
    if (q.data.sidebarBackground) {
      root.style.setProperty("--sidebar", q.data.sidebarBackground);
    }
    document.title = q.data.genossenschaftsName + " – Mitgliederverwaltung";
  }, [q.data]);

  return <Ctx.Provider value={{ settings: q.data, loading: q.isLoading }}>{children}</Ctx.Provider>;
}

export function useBranding(): BrandingCtx {
  return useContext(Ctx);
}