import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getSettings, saveSettings } from "@/services/settings.service";
import { ColorField, toHex } from "@/components/admin/branding-shared";

export const Route = createFileRoute("/app/admin/branding")({
  component: BrandingAdmin,
});

function BrandingAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#2e7d32");
  const [accent, setAccent] = useState("#f5a524");
  const [background, setBackground] = useState("#ffffff");
  const [sidebarBackground, setSidebarBackground] = useState("#f7f7f5");
  const [foreground, setForeground] = useState("#0a0a0a");
  const [sidebarForeground, setSidebarForeground] = useState("#0a0a0a");
  const [logo, setLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (q.data) {
      setName(q.data.genossenschaftsName);
      setPrimary(toHex(q.data.primary));
      setAccent(toHex(q.data.accent));
      setBackground(toHex(q.data.background ?? "#ffffff"));
      setSidebarBackground(toHex(q.data.sidebarBackground ?? "#f7f7f5"));
      setForeground(toHex(q.data.foreground ?? "#0a0a0a"));
      setSidebarForeground(toHex(q.data.sidebarForeground ?? "#0a0a0a"));
      setLogo(q.data.logoDataUrl);
    }
  }, [q.data]);

  const onLogo = (f: File | null) => {
    if (!f) return;
    const r = new FileReader(); r.onload = () => setLogo(r.result as string); r.readAsDataURL(f);
  };

  const save = async () => {
    if (!q.data) return;
    await saveSettings({
      ...q.data,
      genossenschaftsName: name,
      primary,
      accent,
      background,
      sidebarBackground,
      foreground,
      sidebarForeground,
      logoDataUrl: logo,
    });
    qc.invalidateQueries(); toast.success("Gespeichert");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Allgemein</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Name der Genossenschaft</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="md:col-span-2">
            <Label>Logo (PNG/SVG)</Label>
            <Input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
            {logo && (
              <div className="mt-2 flex items-center gap-3">
                <img src={logo} alt="Logo" className="h-16 max-w-[200px] rounded border object-contain" />
                <Button variant="ghost" size="sm" onClick={() => setLogo(undefined)}>Logo entfernen</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Farben</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ColorField label="Primärfarbe" value={primary} onChange={setPrimary} />
          <ColorField label="Akzentfarbe" value={accent} onChange={setAccent} />
          <ColorField label="Hintergrund" value={background} onChange={setBackground} />
          <ColorField label="Textfarbe" value={foreground} onChange={setForeground} />
          <ColorField label="Navigations-Hintergrund" value={sidebarBackground} onChange={setSidebarBackground} />
          <ColorField label="Navigations-Textfarbe" value={sidebarForeground} onChange={setSidebarForeground} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Speichern</Button>
      </div>
    </div>
  );
}