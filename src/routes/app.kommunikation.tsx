import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCampaigns, createCampaign } from "@/services/campaigns.service";
import { listMembers } from "@/services/members.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatDate } from "@/lib/locale";
import type { CampaignType } from "@/lib/types";

export const Route = createFileRoute("/app/kommunikation")({
  component: KommPage,
});

function KommPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: listCampaigns });
  const members = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const [type, setType] = useState<CampaignType>("newsletter");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [newsletterOnly, setNewsletterOnly] = useState(true);

  const recipients = (members.data ?? []).filter((m) => m.status === "active" && (!newsletterOnly || m.newsletter));

  const send = async () => {
    if (!user) return;
    if (!subject) { toast.error("Betreff fehlt"); return; }
    await createCampaign({ type, subject, bodyHtml: body, audience: { newsletterOnly, statuses: ["active"] } }, user);
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
          <div><Label>Inhalt (HTML)</Label><Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} /></div>
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