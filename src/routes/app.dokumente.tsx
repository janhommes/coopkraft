import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listDocuments, uploadDocument, downloadDocument, deleteDocument } from "@/services/documents.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/locale";
import type { DocCategory, DocVisibility } from "@/lib/types";

export const Route = createFileRoute("/app/dokumente")({
  component: DocsPage,
});

function DocsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const docsQ = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const canManage = can(user, "manage:documents:global");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocCategory>("Satzung");
  const [visibility, setVisibility] = useState<DocVisibility>("public");
  const [slug, setSlug] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Datei fehlt");
      await uploadDocument({ title, description, category, visibility, slug: visibility === "public" ? slug || title.toLowerCase().replace(/\s+/g, "-") : undefined } as any, file, user);
    },
    onSuccess: () => { setOpen(false); setTitle(""); setFile(null); qc.invalidateQueries(); toast.success("Hochgeladen"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const visible = (docsQ.data ?? []).filter((d) => !d.memberId).filter((d) => {
    if (d.visibility === "internal") return canManage || user?.roles.some((r) => ["vorstand", "aufsichtsrat", "mitgliederverwalter"].includes(r));
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dokumente</h1>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Hochladen</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Globales Dokument hochladen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div><Label>Beschreibung</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div><Label>Kategorie</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as DocCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["Satzung", "Geschäftsbericht", "Protokoll", "Sonstiges"] as DocCategory[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Sichtbarkeit</Label>
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as DocVisibility)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Öffentlich (z.B. Satzung)</SelectItem>
                      <SelectItem value="members">Nur Mitglieder</SelectItem>
                      <SelectItem value="internal">Nur Verwaltung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {visibility === "public" && <div><Label>Slug (URL: /dokumente/&lt;slug&gt;)</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="satzung" /></div>}
                <div><Label>Datei</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              </div>
              <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button><Button onClick={() => upload.mutate()} disabled={!file || !title}>Hochladen</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Titel</th><th className="p-3">Kategorie</th><th className="p-3">Sichtbarkeit</th><th className="p-3">Datum</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="p-3 font-medium">{d.title}{d.slug && <span className="ml-2 text-xs text-muted-foreground">/dokumente/{d.slug}</span>}</td>
                  <td className="p-3">{d.category}</td>
                  <td className="p-3"><Badge variant="outline">{d.visibility}</Badge></td>
                  <td className="p-3 text-muted-foreground">{formatDate(d.uploadedAt)}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={async () => { const dl = await downloadDocument(d.id); if (dl) { const a = document.createElement("a"); a.href = dl.url; a.download = d.fileName; a.click(); } }}>Download</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={async () => { if (user) { await deleteDocument(d.id, user); qc.invalidateQueries(); } }}>Löschen</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}