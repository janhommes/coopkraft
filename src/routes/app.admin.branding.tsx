import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getSettings, saveSettings } from "@/services/settings.service";
import type { SignupBranding } from "@/lib/types";

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
  const [signup, setSignup] = useState<SignupBranding>({
    intro: "",
    showLogo: true,
    layout: "stepper",
    customCss: "",
    title: "Mitglied werden",
    satzungText: 'Ich habe die <a href="/dokumente/satzung" target="_blank" rel="noreferrer" class="underline">Satzung</a> gelesen und akzeptiere sie.',
    showNewsletter: true,
  });

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
      setSignup({
        intro: q.data.signup?.intro ?? "",
        showLogo: q.data.signup?.showLogo ?? true,
        layout: q.data.signup?.layout ?? "stepper",
        customCss: q.data.signup?.customCss ?? "",
        title: q.data.signup?.title ?? "Mitglied werden",
        satzungText: q.data.signup?.satzungText ?? 'Ich habe die <a href="/dokumente/satzung" target="_blank" rel="noreferrer" class="underline">Satzung</a> gelesen und akzeptiere sie.',
        showNewsletter: q.data.signup?.showNewsletter ?? true,
      });
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
      signup,
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

      <Card>
        <CardHeader><CardTitle>Öffentliches Beitrittsformular</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label>Logo anzeigen</Label>
              <p className="text-xs text-muted-foreground">Zeigt das Logo oben auf der öffentlichen Beitrittsseite.</p>
            </div>
            <Switch checked={signup.showLogo} onCheckedChange={(v) => setSignup({ ...signup, showLogo: v })} />
          </div>

          <div className="flex items-center justify-between rounded border p-3">
            <div>
              <Label>Newsletter-Opt-In zeigen</Label>
              <p className="text-xs text-muted-foreground">Zeigt am Ende des Formulars eine Checkbox zur Newsletter-Anmeldung.</p>
            </div>
            <Switch checked={signup.showNewsletter} onCheckedChange={(v) => setSignup({ ...signup, showNewsletter: v })} />
          </div>

          <div>
            <Label>Titel</Label>
            <Input
              value={signup.title ?? ""}
              onChange={(e) => setSignup({ ...signup, title: e.target.value })}
              placeholder="Mitglied werden"
            />
          </div>

          <div>
            <Label>Layout</Label>
            <RadioGroup
              value={signup.layout}
              onValueChange={(v) => setSignup({ ...signup, layout: v as "stepper" | "single" })}
              className="mt-2 grid gap-2 md:grid-cols-2"
            >
              <label className="flex items-start gap-3 rounded border p-3 cursor-pointer">
                <RadioGroupItem value="stepper" className="mt-0.5" />
                <div>
                  <div className="font-medium">Stepper</div>
                  <p className="text-xs text-muted-foreground">Mehrere Schritte (Persönlich, Adresse, Bank, Anteile, Bestätigung)</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded border p-3 cursor-pointer">
                <RadioGroupItem value="single" className="mt-0.5" />
                <div>
                  <div className="font-medium">Ein langes Formular</div>
                  <p className="text-xs text-muted-foreground">Alle Felder auf einer Seite untereinander</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label>Einleitungstext</Label>
            <Textarea
              rows={5}
              value={signup.intro ?? ""}
              onChange={(e) => setSignup({ ...signup, intro: e.target.value })}
              placeholder="Werde Teil unserer Energiegenossenschaft…"
            />
            <p className="mt-1 text-xs text-muted-foreground">Wird oberhalb des Formulars angezeigt. Zeilenumbrüche werden übernommen.</p>
          </div>

          <div>
            <Label>Text Satzungs-Akzeptanz</Label>
            <Textarea
              rows={3}
              value={signup.satzungText ?? ""}
              onChange={(e) => setSignup({ ...signup, satzungText: e.target.value })}
              placeholder='Ich habe die <a href="/dokumente/satzung">Satzung</a> gelesen…'
            />
            <p className="mt-1 text-xs text-muted-foreground">HTML erlaubt – z. B. für Links auf die Satzung.</p>
          </div>

          <div>
            <Label>Custom CSS</Label>
            <Textarea
              rows={6}
              value={signup.customCss ?? ""}
              onChange={(e) => setSignup({ ...signup, customCss: e.target.value })}
              placeholder={`/* Wird nur auf der öffentlichen Anmeldeseite injiziert */\n.signup-page { font-family: Georgia, serif; }`}
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">Wirkt nur auf der öffentlichen Anmeldeseite (<code>/anmeldung</code> &amp; <code>/embed/anmeldung</code>).</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Alle Änderungen speichern</Button>
      </div>
    </div>
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