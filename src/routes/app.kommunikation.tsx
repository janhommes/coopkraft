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
import { listCampaigns, createCampaign, deleteCampaign } from "@/services/campaigns.service";
import { listMembers } from "@/services/members.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBranding } from "@/components/providers/BrandingProvider";
import { buildBrandedFooter, buildBrandedHeader, renderNewsletterHtml } from "@/lib/newsletter";
import { formatDate } from "@/lib/locale";
import type { Campaign, Member } from "@/lib/types";
import { Bold, Italic, Heading2, List, ListOrdered, Link2, Image as ImageIcon, Quote, Minus, Trash2, Pencil, Search, X, Calendar, Download } from "lucide-react";

export const Route = createFileRoute("/app/kommunikation")({
  component: KommPage,
});

const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "anrede", label: "Anrede" },
  { key: "vorname", label: "Vorname" },
  { key: "nachname", label: "Nachname" },
  { key: "email", label: "E-Mail" },
  { key: "mitgliedsnummer", label: "Mitgliedsnummer" },
  { key: "genossenschaft", label: "Name der Genossenschaft" },
];

function KommPage() {
  const { user } = useAuth();
  const { settings } = useBranding();
  const qc = useQueryClient();
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: listCampaigns });
  const members = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [eventEnabled, setEventEnabled] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [audienceMode, setAudienceMode] = useState<"newsletter" | "all" | "custom">("newsletter");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const activeMembers = (members.data ?? []).filter((m) => m.status === "active");

  const recipients = useMemo(() => {
    if (audienceMode === "all") return activeMembers;
    if (audienceMode === "newsletter") return activeMembers.filter((m) => m.newsletter);
    return activeMembers.filter((m) => selectedIds.includes(m.id));
  }, [activeMembers, audienceMode, selectedIds]);

  const filteredForPicker = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return activeMembers;
    return activeMembers.filter((m) =>
      `${m.vorname} ${m.nachname} ${m.email} ${m.mitgliedsnummer}`.toLowerCase().includes(q),
    );
  }, [activeMembers, memberSearch]);

  const previewMember = recipients[0];
  const previewHtml = useMemo(
    () =>
      renderNewsletterHtml({
        subject: replacePlaceholders(subject, previewMember, settings?.genossenschaftsName),
        bodyHtml: replacePlaceholders(body, previewMember, settings?.genossenschaftsName),
        branding: settings?.newsletter,
      }),
    [subject, body, settings?.newsletter, settings?.genossenschaftsName, previewMember],
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
  const insertBrandedHeader = () => insert(buildBrandedHeader(settings) + "\n");
  const insertBrandedFooter = () => insert("\n" + buildBrandedFooter(settings));
  const insertPlaceholder = (key: string) => insert(`{{${key}}}`);

  const resetForm = () => {
    setEditingId(null);
    setSubject(""); setBody("");
    setEventEnabled(false); setEventTitle(""); setEventStart(""); setEventEnd(""); setEventLocation(""); setEventDescription("");
    setAudienceMode("newsletter"); setSelectedIds([]);
  };

  const loadCampaign = (c: Campaign) => {
    setEditingId(c.id);
    setSubject(c.subject);
    setBody(extractBodyFromRendered(c.bodyHtml));
    if (c.startsAt || c.endsAt || c.location) {
      setEventEnabled(true);
      setEventTitle(c.subject);
      setEventStart(c.startsAt ? toLocalInput(c.startsAt) : "");
      setEventEnd(c.endsAt ? toLocalInput(c.endsAt) : "");
      setEventLocation(c.location ?? "");
      setEventDescription("");
    } else {
      setEventEnabled(false);
      setEventTitle(""); setEventStart(""); setEventEnd(""); setEventLocation(""); setEventDescription("");
    }
    if (c.audience.memberIds && c.audience.memberIds.length) {
      setAudienceMode("custom"); setSelectedIds(c.audience.memberIds);
    } else if (c.audience.newsletterOnly) {
      setAudienceMode("newsletter"); setSelectedIds([]);
    } else {
      setAudienceMode("all"); setSelectedIds([]);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Kampagne geladen");
  };

  const removeCampaign = async (c: Campaign) => {
    if (!user) return;
    if (!window.confirm(`Kampagne „${c.subject}“ wirklich löschen?`)) return;
    await deleteCampaign(c.id, user);
    qc.invalidateQueries();
    toast.success("Kampagne gelöscht");
    if (editingId === c.id) resetForm();
  };

  const send = async () => {
    if (!user) return;
    if (!subject) { toast.error("Betreff fehlt"); return; }
    if (audienceMode === "custom" && selectedIds.length === 0) { toast.error("Bitte mindestens ein Mitglied auswählen"); return; }
    if (eventEnabled && (!eventTitle || !eventStart)) { toast.error("Termin: Titel und Start sind erforderlich"); return; }
    const finalHtml = renderNewsletterHtml({ subject, bodyHtml: body, branding: settings?.newsletter });
    await createCampaign({
      type: "newsletter",
      subject,
      bodyHtml: finalHtml,
      startsAt: eventEnabled ? new Date(eventStart).toISOString() : undefined,
      endsAt: eventEnabled && eventEnd ? new Date(eventEnd).toISOString() : undefined,
      location: eventEnabled ? eventLocation || undefined : undefined,
      audience: {
        newsletterOnly: audienceMode === "newsletter",
        statuses: ["active"],
        memberIds: audienceMode === "custom" ? selectedIds : undefined,
      },
    }, user);
    qc.invalidateQueries();
    resetForm();
    toast.success(`Kampagne erstellt – ${recipients.length} Empfänger`);
  };

  const exportCsv = () => {
    const csv = ["Mitgliedsnr;Vorname;Nachname;E-Mail"]
      .concat(recipients.map((m) => `${m.mitgliedsnummer};${m.vorname};${m.nachname};${m.email}`))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "empfaenger.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kommunikation</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{editingId ? "Kampagne bearbeiten / duplizieren" : "Neue Kampagne"}</CardTitle>
            {editingId && (
              <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                <X className="mr-1 h-4 w-4" /> Abbrechen
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Betreff</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>

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
                <span className="mx-1 h-5 w-px bg-border" />
                <Button type="button" size="sm" variant="ghost" title="Branded Header einfügen" onClick={insertBrandedHeader}>+ Header</Button>
                <Button type="button" size="sm" variant="ghost" title="Branded Footer einfügen" onClick={insertBrandedFooter}>+ Footer</Button>
                <span className="mx-1 h-5 w-px bg-border" />
                <Select onValueChange={(v) => insertPlaceholder(v)}>
                  <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="+ Platzhalter" /></SelectTrigger>
                  <SelectContent>
                    {PLACEHOLDERS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                ref={bodyRef}
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="rounded-none border-0 font-mono text-xs focus-visible:ring-0"
                placeholder={"<p>Hallo {{vorname}},</p>\n<p>willkommen zum Newsletter…</p>"}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              HTML-Editor mit Live-Vorschau. Platzhalter wie <code>{`{{vorname}}`}</code>, <code>{`{{nachname}}`}</code> oder <code>{`{{mitgliedsnummer}}`}</code> werden pro Empfänger ersetzt.
            </p>
          </div>

          <div className="space-y-2 rounded border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label className="m-0">Termin anhängen (.ics)</Label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={eventEnabled} onChange={(e) => {
                  setEventEnabled(e.target.checked);
                  if (e.target.checked && !eventTitle) setEventTitle(subject);
                }} />
                Aktivieren
              </label>
            </div>
            {eventEnabled && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Titel</Label><Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} /></div>
                <div><Label>Beginn</Label><Input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} /></div>
                <div><Label>Ende</Label><Input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Ort</Label><Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="z. B. Genossenschaftshaus, Musterstraße 1" /></div>
                <div className="sm:col-span-2"><Label>Beschreibung (optional)</Label><Textarea rows={2} value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} /></div>
                <div className="sm:col-span-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => downloadIcs({ title: eventTitle, start: eventStart, end: eventEnd, location: eventLocation, description: eventDescription })}>
                    <Download className="mr-1 h-4 w-4" /> .ics-Vorschau herunterladen
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">Die .ics-Datei wird beim Versand als Anhang an alle Empfänger mitgeschickt.</p>
                </div>
              </div>
            )}
          </div>

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
              {previewMember && (
                <p className="mt-1 text-xs text-muted-foreground">Vorschau-Daten von: {previewMember.vorname} {previewMember.nachname}</p>
              )}
          </div>

          <div className="space-y-2 rounded border p-3">
            <Label>Empfänger</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <AudienceCard active={audienceMode === "newsletter"} onClick={() => setAudienceMode("newsletter")} title="Newsletter-Opt-In" desc="Aktive Mitglieder mit Opt-In" />
              <AudienceCard active={audienceMode === "all"} onClick={() => setAudienceMode("all")} title="Alle aktiven Mitglieder" desc="Unabhängig vom Opt-In" />
              <AudienceCard active={audienceMode === "custom"} onClick={() => setAudienceMode("custom")} title="Auswahl (Custom)" desc="Mitglieder einzeln wählen" />
            </div>

            {audienceMode === "custom" && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Suche nach Name, E-Mail, Mitgliedsnr."
                      className="pl-8"
                    />
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds(filteredForPicker.map((m) => m.id))}>Alle markieren</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Leeren</Button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded border">
                  {filteredForPicker.map((m) => {
                    const checked = selectedIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex cursor-pointer items-center gap-2 border-b px-3 py-1.5 text-sm last:border-b-0 hover:bg-accent/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setSelectedIds((prev) => e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id))}
                        />
                        <span className="flex-1">{m.vorname} {m.nachname}</span>
                        <span className="text-xs text-muted-foreground">#{m.mitgliedsnummer} · {m.email}</span>
                        {!m.newsletter && <span className="rounded bg-muted px-1.5 text-[10px] uppercase">kein Opt-In</span>}
                      </label>
                    );
                  })}
                  {filteredForPicker.length === 0 && (
                    <div className="p-3 text-center text-sm text-muted-foreground">Keine Treffer</div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{selectedIds.length} ausgewählt</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">Empfänger insgesamt: <strong>{recipients.length}</strong></p>
          </div>

          <div className="flex gap-2">
            <Button onClick={send}>Kampagne speichern</Button>
            <Button variant="outline" onClick={exportCsv}>Empfänger als CSV</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bisherige Kampagnen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(camps.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kampagnen.</p>}
          {(camps.data ?? []).map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {c.subject}
                  {c.startsAt && <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(c.createdAt)} · von {c.createdBy}
                  {c.startsAt ? ` · Termin ${formatDate(c.startsAt)}` : ""}
                  {c.audience.memberIds?.length
                    ? ` · ${c.audience.memberIds.length} Empfänger (Auswahl)`
                    : c.audience.newsletterOnly ? " · Newsletter-Opt-In" : " · Alle aktiven"}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => loadCampaign(c)} title="In Editor laden">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeCampaign(c)} title="Löschen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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

function AudienceCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border p-3 text-left text-sm transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

function replacePlaceholders(input: string, m: Member | undefined, genossenschaft: string | undefined): string {
  if (!input) return input;
  const map: Record<string, string> = {
    anrede: m?.anrede ?? "",
    vorname: m?.vorname ?? "[Vorname]",
    nachname: m?.nachname ?? "[Nachname]",
    email: m?.email ?? "[E-Mail]",
    mitgliedsnummer: m ? String(m.mitgliedsnummer) : "[Mitgliedsnr]",
    genossenschaft: genossenschaft ?? "",
  };
  return input.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key) => (key in map ? map[key] : `{{${key}}}`));
}

/**
 * Newsletter werden inkl. Header/Footer-Wrapper persistiert. Beim erneuten
 * Laden extrahieren wir den Inhaltsbereich. Nicht-gewrappte Mails
 * (Termin/Mitteilung) bleiben unverändert.
 */
function extractBodyFromRendered(html: string): string {
  const m = html.match(/<tr><td style="padding:24px;[^"]*">([\s\S]*?)<\/td><\/tr>\s*<tr><td>/);
  return (m ? m[1] : html).trim();
}

/** Convert ISO timestamp to value usable in <input type="datetime-local"> */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIcsDate(input: string): string {
  const d = new Date(input);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(opts: { title: string; start: string; end?: string; location?: string; description?: string }): string {
  const start = toIcsDate(opts.start);
  const end = toIcsDate(opts.end || new Date(new Date(opts.start).getTime() + 60 * 60 * 1000).toISOString());
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@genossenschaft`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Genossenschaft//Newsletter//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    opts.location ? `LOCATION:${escapeIcs(opts.location)}` : "",
    opts.description ? `DESCRIPTION:${escapeIcs(opts.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadIcs(opts: { title: string; start: string; end?: string; location?: string; description?: string }): void {
  if (!opts.title || !opts.start) return;
  const ics = buildIcs(opts);
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.title.replace(/[^\w-]+/g, "_") || "termin"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
