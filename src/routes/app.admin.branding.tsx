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
  const [primary, setPrimary] = useState("#2e7d32");
  const [accent, setAccent] = useState("#f5a524");
  const [logo, setLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (q.data) {
      setName(q.data.genossenschaftsName);
      setPrimary(toHex(q.data.primary));
      setAccent(toHex(q.data.accent));
      setLogo(q.data.logoDataUrl);
    }
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
      <ColorField label="Primärfarbe" value={primary} onChange={setPrimary} />
      <ColorField label="Akzentfarbe" value={accent} onChange={setAccent} />
      <div className="md:col-span-2"><Label>Logo (PNG/SVG)</Label><Input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />{logo && <img src={logo} alt="Logo" className="mt-2 h-16 w-16 rounded border object-contain" />}</div>
      <div className="md:col-span-2"><Button onClick={save}>Speichern</Button></div>
    </CardContent></Card>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border bg-background"
          aria-label={label + " Farbwähler"}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#2e7d32" className="font-mono" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Hex-Format, z. B. #2e7d32</p>
    </div>
  );
}

// Best-effort: bestehende oklch-Werte aus älteren Settings als Hex anzeigen.
function toHex(v: string): string {
  if (!v) return "#2e7d32";
  if (v.startsWith("#")) return v;
  if (typeof window !== "undefined") {
    try {
      const el = document.createElement("div");
      el.style.color = v;
      document.body.appendChild(el);
      const rgb = getComputedStyle(el).color;
      document.body.removeChild(el);
      const m = rgb.match(/\d+/g);
      if (m && m.length >= 3) {
        const [r, g, b] = m.map(Number);
        return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
      }
    } catch {}
  }
  return "#2e7d32";
}