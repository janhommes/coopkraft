import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { resetDatabase } from "@/services/seed";
import { exportBackup, getTableCounts, restoreBackup, STORE_LABELS, type BackupFile } from "@/services/backup.service";

export const Route = createFileRoute("/app/admin/datenbank")({
  component: DatenbankAdmin,
});

function DatenbankAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["tableCounts"], queryFn: getTableCounts });
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const doReset = async () => {
    setBusy(true);
    try {
      await resetDatabase();
      window.localStorage.removeItem("demo-active-user");
      toast.success("Demo-Daten zurückgesetzt");
      window.location.reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setConfirmReset(false); }
  };

  const download = async () => {
    setBusy(true);
    try {
      const data = await exportBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `backup-${data.createdAt.slice(0, 19).replace(/[:T]/g, "-")}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Sicherung heruntergeladen");
    } finally { setBusy(false); }
  };

  const pick = async (f?: File) => {
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as BackupFile;
      if (parsed.format !== "egv-backup") throw new Error();
      setPending(parsed);
    } catch { toast.error("Das ist keine gültige Sicherungsdatei"); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending);
      await qc.invalidateQueries();
      toast.success("Sicherung wiederhergestellt");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Wiederherstellen fehlgeschlagen"); }
    finally { setBusy(false); setPending(null); }
  };

  const total = (q.data ?? []).reduce((s, t) => s + t.count, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sicherung</CardTitle>
          <CardDescription>Alle Daten inkl. Dokumente als eine Datei herunterladen oder eine frühere Sicherung einspielen.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={download} disabled={busy}>Sicherung herunterladen</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>Sicherung wiederherstellen…</Button>
          <Button variant="destructive" onClick={() => setConfirmReset(true)} disabled={busy}>Demo-Daten zurücksetzen</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tabellen</CardTitle>
          <CardDescription>{total} Einträge insgesamt</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded border">
            {(q.data ?? []).map((t) => (
              <div key={t.name} className="flex items-center justify-between px-3 py-2 text-sm">
                <div><div className="font-medium">{STORE_LABELS[t.name]}</div><div className="font-mono text-xs text-muted-foreground">{t.name}</div></div>
                <div className="tabular-nums">{t.count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sicherung wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sicherung vom {pending ? new Date(pending.createdAt).toLocaleString("de-DE") : ""}. Alle aktuellen Daten werden dabei vollständig ersetzt. Lade vorher am besten eine aktuelle Sicherung herunter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={restore}>Ersetzen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Demo-Daten zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>Alle aktuellen Daten werden gelöscht und durch die Beispieldaten ersetzt. Anschließend bist du als Greta Admin angemeldet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={doReset}>Zurücksetzen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
