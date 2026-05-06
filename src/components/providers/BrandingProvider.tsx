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

    if (q.data.foreground) {
      root.style.setProperty("--foreground", q.data.foreground);
      root.style.setProperty("--card-foreground", q.data.foreground);
      root.style.setProperty("--popover-foreground", q.data.foreground);
    }
    if (q.data.sidebarForeground) {
      root.style.setProperty("--sidebar-foreground", q.data.sidebarForeground);
      root.style.setProperty("--sidebar-accent-foreground", q.data.sidebarForeground);
    }

    const bg = q.data.background;
    if (bg) {
      root.style.setProperty("--background", bg);
      // Cards/Popover heben sich leicht vom Hintergrund ab (heller bzw. kontrastierend)
      root.style.setProperty("--card", `color-mix(in oklab, ${bg} 80%, white 20%)`);
      root.style.setProperty("--popover", `color-mix(in oklab, ${bg} 80%, white 20%)`);
      // Sekundärflächen leicht abgedunkelt vom Hintergrund (Hover, Muted, Secondary)
      root.style.setProperty("--muted", `color-mix(in oklab, ${bg} 92%, var(--foreground) 8%)`);
      root.style.setProperty("--secondary", `color-mix(in oklab, ${bg} 94%, var(--foreground) 6%)`);
      root.style.setProperty("--border", `color-mix(in oklab, ${bg} 86%, var(--foreground) 14%)`);
      // --input ist nur die Border-Farbe der Inputs, nicht der Hintergrund.
      // Wir lassen die Input-Hintergründe neutral (default Card/Background im Theme),
      // setzen aber eine dezente Border passend zur Fläche.
      root.style.setProperty("--input", `color-mix(in oklab, ${bg} 86%, var(--foreground) 14%)`);
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