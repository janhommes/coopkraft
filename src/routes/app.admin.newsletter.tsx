import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSettings, saveSettings } from "@/services/settings.service";
import type { NewsletterBranding, Settings } from "@/lib/types";
import { buildBrandedFooter, buildBrandedHeader, mergeNewsletterBranding, renderNewsletterHtml } from "@/lib/newsletter";
import { ColorField } from "@/components/admin/branding-shared";

export const Route = createFileRoute("/app/admin/newsletter")({
  component: NewsletterAdmin,
});

function NewsletterAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [value, setValue] = useState<Required<NewsletterBranding>>(mergeNewsletterBranding());

  useEffect(() => { if (q.data) setValue(mergeNewsletterBranding(q.data.newsletter)); }, [q.data]);

  const set = <K extends keyof Required<NewsletterBranding>>(k: K, v: Required<NewsletterBranding>[K]) =>
    setValue({ ...value, [k]: v });

  const previewHtml = renderNewsletterHtml({
    subject: "Vorschau",
    bodyHtml: '<p>Hallo,</p><p>so sieht euer Newsletter mit dem aktuellen Header und Footer aus. Inhalte aus dem Newsletter-Editor erscheinen genau hier.</p><p><a href="#">Beispiel-Link</a></p>',
    branding: value,
  });

  const previewSettings: Pick<Settings, "genossenschaftsName" | "logoDataUrl" | "primary" | "bank"> | undefined = q.data
    ? { genossenschaftsName: q.data.genossenschaftsName, logoDataUrl: q.data.logoDataUrl, primary: q.data.primary, bank: q.data.bank }
    : undefined;

  const generateHeader = () => set("headerHtml", buildBrandedHeader(previewSettings));
  const generateFooter = () => set("footerHtml", buildBrandedFooter(previewSettings));

  const save = async () => {
    if (!q.data) return;
    await saveSettings({ ...q.data, newsletter: value });
    qc.invalidateQueries(); toast.success("Gespeichert");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Newsletter-Branding</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ColorField label="Mail-Hintergrund" value={value.background} onChange={(v) => set("background", v)} />
            <ColorField label="Inhalts-Hintergrund" value={value.contentBackground} onChange={(v) => set("contentBackground", v)} />
            <ColorField label="Textfarbe" value={value.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField label="Akzentfarbe (Links/Buttons)" value={value.accentColor} onChange={(v) => set("accentColor", v)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Header (HTML)</Label>
              <Button type="button" size="sm" variant="outline" onClick={generateHeader}>Aus Branding generieren</Button>
            </div>
            <Textarea rows={6} className="font-mono text-xs" value={value.headerHtml} onChange={(e) => set("headerHtml", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Wird oben in jeder Newsletter-Mail eingefügt. Über „Aus Branding generieren“ wird automatisch ein Header mit Logo, Namen und Primärfarbe erzeugt.</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Footer (HTML)</Label>
              <Button type="button" size="sm" variant="outline" onClick={generateFooter}>Aus Branding generieren</Button>
            </div>
            <Textarea rows={6} className="font-mono text-xs" value={value.footerHtml} onChange={(e) => set("footerHtml", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Wird unten in jeder Newsletter-Mail eingefügt. Platzhalter <code>{`{{unsubscribe_url}}`}</code> wird beim Versand ersetzt.</p>
          </div>
          <div>
            <Label>Vorschau</Label>
            <iframe title="Newsletter-Vorschau" srcDoc={previewHtml} className="mt-1.5 h-[420px] w-full rounded border bg-white" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Speichern</Button>
      </div>
    </div>
  );
}