import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { Trash2, ChevronDown, ChevronRight, FileText, AlertTriangle } from "lucide-react";
import {
  listDividendRuns,
  createDividendRun,
  aggregateByMember,
  deleteDividendRun,
  applyTaxes,
} from "@/services/dividends.service";
import { listMembers } from "@/services/members.service";
import { downloadDocument } from "@/services/documents.service";
import { getSettings } from "@/services/settings.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatEuro, formatDate } from "@/lib/locale";
import type { DividendRun, Member } from "@/lib/types";

export const Route = createFileRoute("/app/dividenden")({
  component: DivPage,
});

function DivPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ["dividends"], queryFn: listDividendRuns });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [rate, setRate] = useState(2);
  const [agg, setAgg] = useState<Awaited<ReturnType<typeof aggregateByMember>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DividendRun | null>(null);

  const stammdatenOk = !!settingsQ.data?.genossenschaft?.name && !!settingsQ.data?.genossenschaft?.strasse;

  const create = async () => {
    if (!user) return;
    setBusy(true);
    const t = toast.loading("Berechne Lauf und erzeuge Bescheinigungen…");
    try {
    const run = await createDividendRun(year, rate, user);
    setAgg(await aggregateByMember(run.items));
    qc.invalidateQueries();
      toast.success(
        `Lauf erstellt: Brutto ${formatEuro(run.totals?.gross ?? run.totalAmount)} · Netto ${formatEuro(run.totals?.net ?? run.totalAmount)} · ${Object.keys(run.certificates ?? {}).length} Bescheinigungen`,
        { id: t },
      );
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!user || !confirmDelete) return;
    try {
      await deleteDividendRun(confirmDelete.id, user);
      qc.invalidateQueries();
      toast.success("Dividendenlauf gelöscht");
      if (openRunId === confirmDelete.id) setOpenRunId(null);
      setConfirmDelete(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const memberMap = new Map((membersQ.data ?? []).map((m) => [m.id, m] as const));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dividenden</h1>
      {!stammdatenOk && (
        <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Bitte zuerst die <Link to="/app/admin/stammdaten" className="font-medium underline">Stammdaten der Genossenschaft</Link> pflegen –
            sonst fehlen auf den Steuerbescheinigungen Adresse und Steuernummer des Ausstellers.
          </div>
        </div>
      )}
      <Card>
        <CardHeader><CardTitle>Neuer Lauf</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Geschäftsjahr</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
          <div><Label>Satz (%)</Label><Input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
          <Button onClick={create} disabled={busy}>{busy ? "Erstelle…" : "Berechnen & speichern"}</Button>
        </CardContent>
      </Card>
      {agg && (
        <Card>
          <CardHeader><CardTitle>Vorschau pro Mitglied</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-[1fr_repeat(4,auto)] gap-x-4 gap-y-1.5 border-b pb-1.5 text-xs font-medium text-muted-foreground">
              <span>Mitglied</span>
              <span className="text-right">Brutto</span>
              <span className="text-right">KapESt+Soli</span>
              <span className="text-right">KiSt</span>
              <span className="text-right">Netto</span>
            </div>
            {agg.slice(0, 30).map((a) => (
              <div key={a.member.id} className="grid grid-cols-[1fr_repeat(4,auto)] items-center gap-x-4 gap-y-1.5 border-b py-1.5">
                <span className="truncate">{a.member.vorname} {a.member.nachname}</span>
                <span className="text-right">{formatEuro(a.gross)}</span>
                <span className="text-right text-muted-foreground">{formatEuro(a.kapest + a.soli)}</span>
                <span className="text-right text-muted-foreground">{formatEuro(a.kist)}</span>
                <span className="text-right font-medium">{formatEuro(a.net)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Historie</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(runs.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Dividendenläufe vorhanden.</p>
          )}
          {(runs.data ?? []).map((r) => {
            const open = openRunId === r.id;
            const empfaenger = new Set(r.items.map((i) => i.memberId)).size;
            return (
              <div key={r.id} className="rounded border text-sm">
                <div className="flex items-center justify-between gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setOpenRunId(open ? null : r.id)}
                    className="flex flex-1 items-center gap-2 text-left hover:underline"
                  >
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>
                      GJ {r.fiscalYear} · {r.ratePercent}% · {formatDate(r.createdAt)} · {empfaenger} Empfänger
                    </span>
                  </button>
                  <span className="font-semibold">{formatEuro(r.totalAmount)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(r)}
                    title="Lauf löschen"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                {open && <RunDetails run={r} memberMap={memberMap} />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dividendenlauf löschen?</DialogTitle>
            <DialogDescription>
              {confirmDelete && (
                <>GJ {confirmDelete.fiscalYear} · {confirmDelete.ratePercent}% · {formatEuro(confirmDelete.totalAmount)}<br />
                Das Löschen kann nicht rückgängig gemacht werden.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={remove}>Endgültig löschen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunDetails({ run, memberMap }: { run: DividendRun; memberMap: Map<string, Member> }) {
  // Aggregate per Mitglied
  const perMember = new Map<string, { total: number; count: number }>();
  for (const it of run.items) {
    const e = perMember.get(it.memberId) ?? { total: 0, count: 0 };
    e.total += it.amount;
    e.count += 1;
    perMember.set(it.memberId, e);
  }
  const rows = Array.from(perMember.entries())
    .map(([memberId, v]) => ({
      memberId,
      member: memberMap.get(memberId),
      total: +v.total.toFixed(2),
      count: v.count,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-3 px-2 text-xs font-medium text-muted-foreground">
        <span>Mitglied</span>
        <span className="text-right">Lots</span>
        <span className="text-right">Auszahlung</span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.memberId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded px-2 py-1.5 hover:bg-accent">
            <div className="truncate">
              {r.member ? (
                <Link
                  to="/app/mitglieder/$id"
                  params={{ id: r.memberId }}
                  className="hover:underline"
                >
                  Nr. {r.member.mitgliedsnummer} – {r.member.vorname} {r.member.nachname}
                </Link>
              ) : (
                <span className="text-muted-foreground italic">Mitglied gelöscht ({r.memberId.slice(0, 6)})</span>
              )}
            </div>
            <span className="text-right text-xs text-muted-foreground">{r.count}</span>
            <span className="text-right font-medium">{formatEuro(r.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}