import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSettings, saveSettings } from "@/services/settings.service";

export const Route = createFileRoute("/app/admin/branding")({
  component: BrandingAdmin,
});

function BrandingAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("");
  const [accent, setAccent] = useState("");
  const [logo, setLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (q.data) { setName(q.data.genossenschaftsName); setPrimary(q.data.primary); setAccent(q.data.accent); setLogo(q.data.logoDataUrl); }
  }, [q.data]);

  const onLogo = (f: File | null) => {
    if (!f) return;
    const r = new FileReader(); r.onload = () => setLogo(r.result as string); r.readAsDataURL(f);
  };

  const save = async () => {
    if (!q.data) return;
    await saveSettings({ ...q.data, genossenschaftsName: name, primary, accent, logoDataUrl: logo });
    qc.invalidateQueries(); toast.success("Gespeichert");
  };

  return (
    <Card><CardContent className="grid gap-4 p-6 md:grid-cols-2">
      <div className="md:col-span-2"><Label>Name der Genossenschaft</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div><Label>Primärfarbe (oklch)</Label><Input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="oklch(0.55 0.15 145)" /></div>
      <div><Label>Akzentfarbe (oklch)</Label><Input value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="oklch(0.7 0.18 75)" /></div>
      <div className="md:col-span-2"><Label>Logo (PNG/SVG)</Label><Input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />{logo && <img src={logo} alt="Logo" className="mt-2 h-16 w-16 rounded border object-contain" />}</div>
      <div className="md:col-span-2"><Button onClick={save}>Speichern</Button></div>
    </CardContent></Card>
  );
}