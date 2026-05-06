import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCampaigns, createCampaign } from "@/services/campaigns.service";
import { listMembers } from "@/services/members.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBranding } from "@/components/providers/BrandingProvider";
import { renderNewsletterHtml } from "@/lib/newsletter";
import { formatDate } from "@/lib/locale";
import type { CampaignType } from "@/lib/types";
import { Bold, Italic, Heading2, List, ListOrdered, Link2, Image as ImageIcon, Quote, Minus } from "lucide-react";

export const Route = createFileRoute("/app/kommunikation")({
  component: KommPage,
});

function KommPage() {
  const { user } = useAuth();
  const { settings } = useBranding();
  const qc = useQueryClient();
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: listCampaigns });
  const members = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const [type, setType] = useState<CampaignType>("newsletter");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [newsletterOnly, setNewsletterOnly] = useState(true);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const recipients = (members.data ?? []).filter((m) => m.status === "active" && (!newsletterOnly || m.newsletter));

  const previewHtml = useMemo(
    () => renderNewsletterHtml({ subject, bodyHtml: body, branding: settings?.newsletter }),
    [subject, body, settings?.newsletter],
  );

  const wrap = (before: string, after = before) => {
    const ta = bodyRef.current; if (!ta) { setBody(body + before + after); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = body.slice(start, end);
    const next = body.slice(0, start) + before + sel + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + before.length, start + before.length + sel.length); });
  };
  const insert = (snippet: string) => {
    const ta = bodyRef.current; if (!ta) { setBody(body + snippet); return; }
    const start = ta.selectionStart, end = ta.selectionEnd;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + snippet.length, start + snippet.length); });
  };
  const insertLink = () => {
    const url = window.prompt("Link-URL:", "https://"); if (!url) return;
    const ta = bodyRef.current; const sel = ta ? body.slice(ta.selectionStart, ta.selectionEnd) : "";
    const text = sel || window.prompt("Link-Text:", "Hier klicken") || url;
    const accent = settings?.newsletter?.accentColor ?? "#2e7d32";
    insert(`<a href="${url}" style="color:${accent};">${text}</a>`);
  };
  const insertImage = () => {
    const url = window.prompt("Bild-URL:", "https://"); if (!url) return;
    insert(`<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:4px;" />`);
  };
  const insertButton = () => {
    const url = window.prompt("Button-URL:", "https://"); if (!url) return;
    const text = window.prompt("Button-Text:", "Mehr erfahren") || "Mehr erfahren";
    const accent = settings?.newsletter?.accentColor ?? "#2e7d32";
    insert(`\n<p style="text-align:center;margin:20px 0;"><a href="${url}" style="background:${accent};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:600;">${text}</a></p>\n`);
  };

  const send = async () => {
    if (!user) return;
    if (!subject) { toast.error("Betreff fehlt"); return; }
    const finalHtml = type === "newsletter"
      ? renderNewsletterHtml({ subject, bodyHtml: body, branding: settings?.newsletter })
      : body;
    await createCampaign({ type, subject, bodyHtml: finalHtml, audience: { newsletterOnly, statuses: ["active"] } }, user);
    qc.invalidateQueries(); setSubject(""); setBody("");
    toast.success(`Kampagne erstellt – ${recipients.length} Empfänger`);
  };

  const exportCsv = () => {
    const csv = ["Mitgliedsnr;Vorname;Nachname;E-Mail"].concat(recipients.map((m) => `${m.mitgliedsnummer};${m.vorname};${m.nachname};${m.email}`)).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "empfaenger.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kommunikation</h1>
      <Card>
        <CardHeader><CardTitle>Neue Kampagne</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Typ</Label>
              <Select value={type} onValueChange={(v) => setType(v as CampaignType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="termin">Termin</SelectItem>
                  <SelectItem value="mitteilung">Mitteilung</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Betreff</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          </div>
          <div>
            <Label>Inhalt</Label>
            <div className="mt-1.5 rounded border">
              <div className="flex flex-wrap items-center gap-1 border-b bg-muted/50 p-1.5">
                <ToolbarBtn title="Überschrift" onClick={() => wrap("<h2 style=\"margin:0 0 12px;font-size:20px;\">", "</h2>")}><Heading2 className="h-4 w-4" /></ToolbarBtn>
                <ToolbarBtn title="Fett" onClick={() => wrap("<strong>", "</strong>")}><Bold className="h-4 w-4" /></ToolbarBtn>
                <ToolbarBtn title="Kursiv" onClick={() => wrap("<em>", "</em>")}><Italic className="h-4 w-4" /></ToolbarBtn>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolbarBtn title="Aufzählung" onClick={() => insert("\n<ul>\n  <li>Punkt 1</li>\n  <li>Punkt 2</li>\n</ul>\n")}><List className="h-4 w-4" /></ToolbarBtn>
                <ToolbarBtn title="Nummerierte Liste" onClick={() => insert("\n<ol>\n  <li>Schritt 1</li>\n  <li>Schritt 2</li>\n</ol>\n")}><ListOrdered className="h-4 w-4" /></ToolbarBtn>
                <ToolbarBtn title="Zitat" onClick={() => wrap("<blockquote style=\"border-left:3px solid #ccc;margin:12px 0;padding:4px 12px;color:#555;\">", "</blockquote>")}><Quote className="h-4 w-4" /></ToolbarBtn>
                <ToolbarBtn title="Trennlinie" onClick={() => insert("\n<hr style=\"border:none;border-top:1px solid #e5e5e5;margin:20px 0;\" />\n")}><Minus className="h-4 w-4" /></ToolbarBtn>
                <span className="mx-1 h-5 w-px bg-border" />
                <ToolbarBtn title="Link einfügen" onClick={insertLink}><Link2 className="h-4 w-4" /></ToolbarBtn>
                <ToolbarBtn title="Bild einfügen" onClick={insertImage}><ImageIcon className="h-4 w-4" /></ToolbarBtn>
                <Button type="button" size="sm" variant="ghost" onClick={insertButton}>+ Button</Button>
              </div>
              <Textarea
                ref={bodyRef}
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="rounded-none border-0 font-mono text-xs focus-visible:ring-0"
                placeholder="<p>Hallo,</p>\n<p>willkommen zum Newsletter…</p>"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">HTML-Editor mit Live-Vorschau. Header und Footer werden aus dem Branding übernommen.</p>
          </div>

          {type === "newsletter" && (
            <div>
              <Label>Vorschau</Label>
              <Tabs defaultValue="desktop" className="mt-1.5">
                <TabsList>
                  <TabsTrigger value="desktop">Desktop</TabsTrigger>
                  <TabsTrigger value="mobile">Mobil</TabsTrigger>
                  <TabsTrigger value="source">Quelltext</TabsTrigger>
                </TabsList>
                <TabsContent value="desktop">
                  <iframe title="Newsletter-Vorschau Desktop" srcDoc={previewHtml} className="h-[600px] w-full rounded border bg-white" />
                </TabsContent>
                <TabsContent value="mobile">
                  <div className="flex justify-center">
                    <iframe title="Newsletter-Vorschau Mobil" srcDoc={previewHtml} style={{ width: 380 }} className="h-[640px] rounded border bg-white" />
                  </div>
                </TabsContent>
                <TabsContent value="source">
                  <Textarea readOnly rows={16} value={previewHtml} className="font-mono text-xs" />
                </TabsContent>
              </Tabs>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newsletterOnly} onChange={(e) => setNewsletterOnly(e.target.checked)} /> Nur Mitglieder mit Newsletter-Opt-In</label>
          <p className="text-sm text-muted-foreground">Empfänger: {recipients.length}</p>
          <div className="flex gap-2"><Button onClick={send}>Kampagne speichern</Button><Button variant="outline" onClick={exportCsv}>Empfänger als CSV</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Bisherige Kampagnen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(camps.data ?? []).map((c) => (
            <div key={c.id} className="rounded border p-3 text-sm">
              <div className="font-medium">{c.subject}</div>
              <div className="text-xs text-muted-foreground">{c.type} · {formatDate(c.createdAt)} · von {c.createdBy}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ToolbarBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant="ghost" title={title} onClick={onClick} className="h-8 w-8 p-0">
      {children}
    </Button>
  );
}