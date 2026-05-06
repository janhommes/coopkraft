import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listDividendRuns, createDividendRun, aggregateByMember } from "@/services/dividends.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatEuro, formatDate } from "@/lib/locale";

export const Route = createFileRoute("/app/dividenden")({
  component: DivPage,
});

function DivPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ["dividends"], queryFn: listDividendRuns });
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [rate, setRate] = useState(2);
  const [agg, setAgg] = useState<Awaited<ReturnType<typeof aggregateByMember>> | null>(null);

  const create = async () => {
    if (!user) return;
    const run = await createDividendRun(year, rate, user);
    setAgg(await aggregateByMember(run.items));
    qc.invalidateQueries();
    toast.success(`Dividendenlauf erstellt: ${formatEuro(run.totalAmount)}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dividenden</h1>
      <Card>
        <CardHeader><CardTitle>Neuer Lauf</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Geschäftsjahr</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
          <div><Label>Satz (%)</Label><Input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
          <Button onClick={create}>Berechnen & speichern</Button>
        </CardContent>
      </Card>
      {agg && (
        <Card>
          <CardHeader><CardTitle>Vorschau pro Mitglied</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {agg.slice(0, 20).map((a) => (
              <div key={a.member.id} className="flex justify-between border-b py-1.5"><span>{a.member.vorname} {a.member.nachname}</span><span>{formatEuro(a.total)}</span></div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Historie</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(runs.data ?? []).map((r) => (
            <div key={r.id} className="flex justify-between rounded border p-3 text-sm">
              <span>GJ {r.fiscalYear} · {r.ratePercent}% · {formatDate(r.createdAt)}</span>
              <span className="font-semibold">{formatEuro(r.totalAmount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}