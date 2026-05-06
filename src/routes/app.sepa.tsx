import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listDividendRuns, aggregateByMember } from "@/services/dividends.service";
import { listLots } from "@/services/shares.service";
import { listMembers } from "@/services/members.service";
import { getSettings } from "@/services/settings.service";
import { generateSepaXml, type SepaPayment } from "@/services/sepa.service";
import { formatEuro } from "@/lib/locale";

export const Route = createFileRoute("/app/sepa")({
  component: SepaPage,
});

function SepaPage() {
  const runs = useQuery({ queryKey: ["dividends"], queryFn: listDividendRuns });
  const lots = useQuery({ queryKey: ["lots"], queryFn: listLots });
  const members = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const settings = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [source, setSource] = useState<"dividend" | "repayment">("dividend");
  const [runId, setRunId] = useState("");
  const [exec, setExec] = useState(new Date().toISOString().slice(0, 10));

  const buildPayments = async (): Promise<SepaPayment[]> => {
    const ms = members.data ?? [];
    if (source === "dividend") {
      const r = (runs.data ?? []).find((x) => x.id === runId);
      if (!r) return [];
      const agg = await aggregateByMember(r.items);
      return agg.map((a) => ({ member: a.member, amount: a.total, purpose: `Dividende ${r.fiscalYear}` }));
    }
    // Anteilsrückzahlung: alle terminating-Lots mit payoutDate <= exec
    const due = (lots.data ?? []).filter((l) => l.status === "terminating" && l.payoutDate && l.payoutDate <= exec);
    return due.map((l) => {
      const m = ms.find((x) => x.id === l.memberId)!;
      return { member: m, amount: l.count * l.valuePerShare, purpose: `Anteilsrückzahlung ${l.count} Anteile` };
    }).filter((p) => p.member);
  };

  const download = async () => {
    if (!settings.data) return;
    const payments = await buildPayments();
    if (payments.length === 0) { toast.error("Keine Zahlungen"); return; }
    const xml = generateSepaXml(settings.data, payments, exec);
    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const a = document.createElement("a"); a.href = url; a.download = `sepa-${exec}.xml`; a.click();
    toast.success(`${payments.length} Zahlungen, gesamt ${formatEuro(payments.reduce((s, p) => s + p.amount, 0))}`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">SEPA-Sammelüberweisung</h1>
      <Card>
        <CardHeader><CardTitle>Lauf erstellen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Quelle</Label>
            <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dividend">Dividendenlauf</SelectItem>
                <SelectItem value="repayment">Anteilsrückzahlung (fällig)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {source === "dividend" && (
            <div><Label>Dividendenlauf</Label>
              <Select value={runId} onValueChange={setRunId}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>
                  {(runs.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>GJ {r.fiscalYear} – {formatEuro(r.totalAmount)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Ausführungsdatum</Label><Input type="date" value={exec} onChange={(e) => setExec(e.target.value)} /></div>
          <Button onClick={download}>SEPA-XML herunterladen</Button>
        </CardContent>
      </Card>
    </div>
  );
}