import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ensureBaseline, seedIfEmpty } from "@/services/seed";
import { processDueTerminations } from "@/services/terminations.service";
import { useAuth } from "./AuthProvider";

export function AppBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  const { user, mode } = useAuth();

  useEffect(() => {
    if (mode !== "demo") return;
    let cancelled = false;
    (async () => {
      try {
        await seedIfEmpty();
        await processDueTerminations(null);
      } catch (e) {
        console.error("Bootstrap-Fehler", e);
      } finally {
        if (!cancelled) {
          setReady(true);
          qc.invalidateQueries();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc, mode]);

  // Serverbetrieb: Grundkonfiguration anlegen (Admin) und fällige Kündigungen verarbeiten
  // (Verwaltung; wandert in Phase 2 ins Backend). Läuft mit den Rechten des angemeldeten Benutzers.
  const userId = user?.id;
  useEffect(() => {
    if (mode !== "sso" || !user) return;
    (async () => {
      try {
        if (user.roles.includes("admin")) await ensureBaseline();
        if (user.roles.some((r) => r !== "mitglied")) await processDueTerminations(user);
      } catch (e) {
        console.error("Bootstrap-Fehler", e);
      } finally {
        qc.invalidateQueries();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, mode, userId]);

  if (mode === "demo" && !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Lade Genossenschafts-Daten…
      </div>
    );
  }
  return <>{children}</>;
}
