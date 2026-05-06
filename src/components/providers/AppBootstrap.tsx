import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { seedIfEmpty } from "@/services/seed";
import { processDueTerminations } from "@/services/terminations.service";

export function AppBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
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
  }, [qc]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Lade Genossenschafts-Daten…
      </div>
    );
  }
  return <>{children}</>;
}