import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSettings, saveSettings } from "@/services/settings.service";
import type { Land } from "@/lib/types";
import { LAND_LABELS } from "@/lib/locale";

export const Route = createFileRoute("/app/admin/konto")({
  component: KontoAdmin,
});

function KontoAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [s, setS] = useState({ kontoinhaber: "", iban: "", bic: "", glaeubigerId: "", land: "DE" as Land });
  useEffect(() => { if (q.data) setS({ ...q.data.bank, glaeubigerId: q.data.bank.glaeubigerId ?? "" }); }, [q.data]);
  const save = async () => { if (!q.data) return; await saveSettings({ ...q.data, bank: s }); qc.invalidateQueries(); toast.success("Gespeichert"); };
  return (
    <Card><CardContent className="grid gap-3 p-6 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Kontoinhaber</Label><Input value={s.kontoinhaber} onChange={(e) => setS({ ...s, kontoinhaber: e.target.value })} /></div>
      <div className="md:col-span-2"><Label>IBAN</Label><Input value={s.iban} onChange={(e) => setS({ ...s, iban: e.target.value.toUpperCase() })} /></div>
      <div><Label>BIC</Label><Input value={s.bic} onChange={(e) => setS({ ...s, bic: e.target.value.toUpperCase() })} /></div>
      <div><Label>Gläubiger-ID</Label><Input value={s.glaeubigerId} onChange={(e) => setS({ ...s, glaeubigerId: e.target.value })} /></div>
      <div><Label>Land</Label>
        <Select value={s.land} onValueChange={(v) => setS({ ...s, land: v as Land })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{(["DE", "AT", "CH"] as Land[]).map((l) => <SelectItem key={l} value={l}>{LAND_LABELS[l]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2"><Button onClick={save}>Speichern</Button></div>
    </CardContent></Card>
  );
}