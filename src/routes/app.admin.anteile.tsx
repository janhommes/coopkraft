import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSettings, saveSettings } from "@/services/settings.service";

export const Route = createFileRoute("/app/admin/anteile")({
  component: AnteileAdmin,
});

function AnteileAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [wert, setWert] = useState(0);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(100);
  useEffect(() => { if (q.data) { setWert(q.data.anteilsWert); setMin(q.data.minAnteile); setMax(q.data.maxAnteile); } }, [q.data]);
  const save = async () => { if (!q.data) return; await saveSettings({ ...q.data, anteilsWert: wert, minAnteile: min, maxAnteile: max }); qc.invalidateQueries(); toast.success("Gespeichert"); };
  return (
    <Card><CardContent className="grid gap-4 p-6 md:grid-cols-3">
      <div><Label>Anteilswert (€)</Label><Input type="number" value={wert} onChange={(e) => setWert(Number(e.target.value))} /></div>
      <div><Label>Min Anteile</Label><Input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} /></div>
      <div><Label>Max Anteile</Label><Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} /></div>
      <div className="md:col-span-3"><Button onClick={save}>Speichern</Button></div>
    </CardContent></Card>
  );
}