import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/app/admin/anmeldung")({
  component: SignupAdmin,
});

function SignupAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
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
    if (q.data?.signup) setSignup({
      intro: q.data.signup.intro ?? "",
      showLogo: q.data.signup.showLogo ?? true,
      layout: q.data.signup.layout ?? "stepper",
      customCss: q.data.signup.customCss ?? "",
      title: q.data.signup.title ?? "Mitglied werden",
      satzungText: q.data.signup.satzungText ?? 'Ich habe die <a href="/dokumente/satzung" target="_blank" rel="noreferrer" class="underline">Satzung</a> gelesen und akzeptiere sie.',
      showNewsletter: q.data.signup.showNewsletter ?? true,
    });
  }, [q.data]);

  const save = async () => {
    if (!q.data) return;
    await saveSettings({ ...q.data, signup });
    qc.invalidateQueries(); toast.success("Gespeichert");
  };

  return (
    <div className="space-y-6">
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
            <Input value={signup.title ?? ""} onChange={(e) => setSignup({ ...signup, title: e.target.value })} placeholder="Mitglied werden" />
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
            <Textarea rows={5} value={signup.intro ?? ""} onChange={(e) => setSignup({ ...signup, intro: e.target.value })} placeholder="Werde Teil unserer Energiegenossenschaft…" />
            <p className="mt-1 text-xs text-muted-foreground">Wird oberhalb des Formulars angezeigt. Zeilenumbrüche werden übernommen.</p>
          </div>

          <div>
            <Label>Text Satzungs-Akzeptanz</Label>
            <Textarea rows={3} value={signup.satzungText ?? ""} onChange={(e) => setSignup({ ...signup, satzungText: e.target.value })} placeholder='Ich habe die <a href="/dokumente/satzung">Satzung</a> gelesen…' />
            <p className="mt-1 text-xs text-muted-foreground">HTML erlaubt – z. B. für Links auf die Satzung.</p>
          </div>

          <div>
            <Label>Custom CSS</Label>
            <Textarea rows={6} value={signup.customCss ?? ""} onChange={(e) => setSignup({ ...signup, customCss: e.target.value })} placeholder={`/* Wird nur auf der öffentlichen Anmeldeseite injiziert */\n.signup-page { font-family: Georgia, serif; }`} className="font-mono text-xs" />
            <p className="mt-1 text-xs text-muted-foreground">Wirkt nur auf der öffentlichen Anmeldeseite (<code>/anmeldung</code> &amp; <code>/embed/anmeldung</code>).</p>
          </div>
        </CardContent>
      </Card>

      <EmbedCard />

      <div className="flex justify-end">
        <Button onClick={save}>Speichern</Button>
      </div>
    </div>
  );
}

function EmbedCard() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/anmeldung`;
  const embedUrl = `${origin}/embed/anmeldung`;
  const snippet = `<div id="egv-anmeldung"></div>
<script>
(function(){
  var c = document.getElementById('egv-anmeldung');
  var f = document.createElement('iframe');
  f.src = ${JSON.stringify(embedUrl)};
  f.style.width = '100%';
  f.style.border = '0';
  f.style.minHeight = '600px';
  f.setAttribute('loading','lazy');
  f.setAttribute('title','Beitrittsformular');
  c.appendChild(f);
  window.addEventListener('message', function(e){
    if (e && e.data && e.data.type === 'egv:resize' && typeof e.data.height === 'number') {
      f.style.height = (e.data.height + 32) + 'px';
    }
  });
})();
</script>`;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(label + " kopiert"); }
    catch { toast.error("Kopieren fehlgeschlagen"); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Einbettung &amp; Link</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <Label>Direkter Link zum Beitrittsformular</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input readOnly value={publicUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={() => copy(publicUrl, "Link")}>Kopieren</Button>
            <Button type="button" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">Öffnen</a>
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Diesen Link könnt ihr direkt teilen oder verlinken.</p>
        </div>

        <div>
          <Label>Embed-Code für eure Webseite</Label>
          <Textarea readOnly rows={14} value={snippet} className="font-mono text-xs" />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => copy(snippet, "Embed-Code")}>Embed-Code kopieren</Button>
            <Button type="button" variant="outline" asChild>
              <a href={embedUrl} target="_blank" rel="noreferrer">Embed-Vorschau</a>
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Fügt den Code an der gewünschten Stelle eurer Webseite ein. Das iframe passt seine Höhe automatisch an den Inhalt an.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}