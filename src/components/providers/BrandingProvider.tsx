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

    const bg = q.data.background;
    if (bg) {
      root.style.setProperty("--background", bg);
      // Cards/Popover identisch mit Hintergrund
      root.style.setProperty("--card", bg);
      root.style.setProperty("--popover", bg);
      // Sekundärflächen leicht abgedunkelt vom Hintergrund (Hover, Muted, Secondary)
      root.style.setProperty("--muted", `color-mix(in oklab, ${bg} 92%, var(--foreground) 8%)`);
      root.style.setProperty("--secondary", `color-mix(in oklab, ${bg} 94%, var(--foreground) 6%)`);
      root.style.setProperty("--border", `color-mix(in oklab, ${bg} 86%, var(--foreground) 14%)`);
      root.style.setProperty("--input", `color-mix(in oklab, ${bg} 88%, var(--foreground) 12%)`);
    }

    const sb = q.data.sidebarBackground;
    if (sb) {
      root.style.setProperty("--sidebar", sb);
      root.style.setProperty("--sidebar-accent", `color-mix(in oklab, ${sb} 86%, var(--foreground) 14%)`);
      root.style.setProperty("--sidebar-border", `color-mix(in oklab, ${sb} 88%, var(--foreground) 12%)`);
    }

    document.title = q.data.genossenschaftsName + " – Mitgliederverwaltung";
  }, [q.data]);

  return <Ctx.Provider value={{ settings: q.data, loading: q.isLoading }}>{children}</Ctx.Provider>;
}

export function useBranding(): BrandingCtx {
  return useContext(Ctx);
}