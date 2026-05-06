import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getWorkflow, saveWorkflow } from "@/services/settings.service";
import { ALL_ROLES, ROLE_LABELS, type KuendigungsKonfig, type Role, type StichtagKind, type WorkflowConfig } from "@/lib/types";
import { calcEffectiveDate } from "@/lib/termination";
import { formatDate } from "@/lib/locale";

export const Route = createFileRoute("/app/admin/workflow")({
  component: WorkflowAdmin,
});

function WorkflowAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["workflow"], queryFn: getWorkflow });
  const [w, setW] = useState<WorkflowConfig | null>(null);
  useEffect(() => { if (q.data) setW(q.data); }, [q.data]);
  if (!w) return null;
  const save = async () => { await saveWorkflow(w); qc.invalidateQueries(); toast.success("Gespeichert"); };
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Beitritt</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">
        <div><Label>Anzahl Bestätigungen</Label><Input type="number" value={w.beitritt.anzahlBestaetigungen} onChange={(e) => setW({ ...w, beitritt: { ...w.beitritt, anzahlBestaetigungen: Number(e.target.value) } })} /></div>
        <label className="flex items-center gap-2 self-end text-sm"><Checkbox checked={w.beitritt.zahlungPflicht} onCheckedChange={(c) => setW({ ...w, beitritt: { ...w.beitritt, zahlungPflicht: !!c } })} /> Zahlungseingang erforderlich</label>
        <label className="flex items-center gap-2 self-end text-sm"><Checkbox checked={w.beitritt.aufsichtsratPflicht} onCheckedChange={(c) => setW({ ...w, beitritt: { ...w.beitritt, aufsichtsratPflicht: !!c } })} /> Aufsichtsrat-Mitfreigabe</label>
        {w.beitritt.aufsichtsratPflicht && <div><Label>Aufsichtsrat-Anzahl</Label><Input type="number" value={w.beitritt.aufsichtsratAnzahl} onChange={(e) => setW({ ...w, beitritt: { ...w.beitritt, aufsichtsratAnzahl: Number(e.target.value) } })} /></div>}
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={w.beitritt.verhindereDoppelapproval} onCheckedChange={(c) => setW({ ...w, beitritt: { ...w.beitritt, verhindereDoppelapproval: !!c } })} /> Doppelapproval verhindern</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={w.beitritt.verhindereSelfApproval} onCheckedChange={(c) => setW({ ...w, beitritt: { ...w.beitritt, verhindereSelfApproval: !!c } })} /> Self-Approval verhindern</label>
      </CardContent></Card>

      <KuendigungBlock title="Kündigung Mitgliedschaft" cfg={w.membership} onChange={(c) => setW({ ...w, membership: c })} />
      <KuendigungBlock title="Kündigung einzelner Anteile" cfg={w.share} onChange={(c) => setW({ ...w, share: c })} />

      <Card><CardHeader><CardTitle>Anteilsübertragung</CardTitle></CardHeader><CardContent className="space-y-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={w.transfer.verkaufErlaubt} onCheckedChange={(c) => setW({ ...w, transfer: { ...w.transfer, verkaufErlaubt: !!c } })} /> Verkauf erlaubt</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={w.transfer.spendeErlaubt} onCheckedChange={(c) => setW({ ...w, transfer: { ...w.transfer, spendeErlaubt: !!c } })} /> Spende erlaubt</label>
        <RolePicker label="Bestätigung durch" roles={w.transfer.bestaetigerRollen} onChange={(rs) => setW({ ...w, transfer: { ...w.transfer, bestaetigerRollen: rs } })} />
      </CardContent></Card>

      <Button onClick={save}>Speichern</Button>
    </div>
  );
}

function KuendigungBlock({ title, cfg, onChange }: { title: string; cfg: KuendigungsKonfig; onChange: (c: KuendigungsKonfig) => void }) {
  const preview = calcEffectiveDate(cfg, new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 5).toISOString());
  return (
    <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">
      <div><Label>Frist – Anzahl</Label><Input type="number" value={cfg.fristAnzahl} onChange={(e) => onChange({ ...cfg, fristAnzahl: Number(e.target.value) })} /></div>
      <div><Label>Einheit</Label>
        <Select value={cfg.fristEinheit} onValueChange={(v) => onChange({ ...cfg, fristEinheit: v as "month" | "year" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="month">Monate</SelectItem><SelectItem value="year">Jahre</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>Stichtag</Label>
        <Select value={cfg.stichtag} onValueChange={(v) => onChange({ ...cfg, stichtag: v as StichtagKind })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthEnd">Monatsende</SelectItem>
            <SelectItem value="quarterEnd">Quartalsende</SelectItem>
            <SelectItem value="halfYearEnd">Halbjahresende</SelectItem>
            <SelectItem value="yearEnd">Jahresende</SelectItem>
            <SelectItem value="free">Frei (exaktes Datum)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Mindesthaltedauer (Monate)</Label><Input type="number" value={cfg.mindestHaltedauerMonate} onChange={(e) => onChange({ ...cfg, mindestHaltedauerMonate: Number(e.target.value) })} /></div>
      <div><Label>Anzahl Bestätigungen</Label><Input type="number" value={cfg.anzahlBestaetigungen} onChange={(e) => onChange({ ...cfg, anzahlBestaetigungen: Number(e.target.value) })} /></div>
      <div><Label>Auszahlung</Label>
        <Select value={cfg.auszahlung} onValueChange={(v) => onChange({ ...cfg, auszahlung: v as KuendigungsKonfig["auszahlung"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="immediate">Sofort am Stichtag</SelectItem><SelectItem value="afterFiscalYear">Nach Bilanzfeststellung</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="md:col-span-3"><RolePicker label="Bestätigung durch" roles={cfg.bestaetigerRollen} onChange={(rs) => onChange({ ...cfg, bestaetigerRollen: rs })} /></div>
      <p className="md:col-span-3 text-sm text-muted-foreground">Live-Vorschau: würde ein Mitglied (5 Jahre dabei) heute kündigen, wäre der Austritt zum <strong>{formatDate(preview.toISOString())}</strong>.</p>
    </CardContent></Card>
  );
}

function RolePicker({ label, roles, onChange }: { label: string; roles: Role[]; onChange: (r: Role[]) => void }) {
  const toggle = (r: Role) => onChange(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {ALL_ROLES.map((r) => (
          <label key={r} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
            <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggle(r)} />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </div>
    </div>
  );
}