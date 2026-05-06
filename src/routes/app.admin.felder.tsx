import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCustomFields, saveCustomField, deleteCustomField } from "@/services/customFields.service";
import { uid } from "@/services/db";
import type { CustomFieldDef, CustomFieldType } from "@/lib/types";

export const Route = createFileRoute("/app/admin/felder")({
  component: CustomFieldsAdmin,
});

function CustomFieldsAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customFields"], queryFn: listCustomFields });
  const [draft, setDraft] = useState<Partial<CustomFieldDef>>({ type: "text", required: false, showOnSignup: true });
  const add = async () => {
    if (!draft.key || !draft.label) { toast.error("Schlüssel und Label sind Pflicht"); return; }
    const f: CustomFieldDef = { id: uid(), key: draft.key!, label: draft.label!, type: (draft.type ?? "text") as CustomFieldType, required: !!draft.required, showOnSignup: !!draft.showOnSignup, options: draft.options };
    await saveCustomField(f); setDraft({ type: "text", required: false, showOnSignup: true }); qc.invalidateQueries(); toast.success("Feld angelegt");
  };
  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-3 p-6 md:grid-cols-5">
        <div><Label>Schlüssel</Label><Input value={draft.key ?? ""} onChange={(e) => setDraft({ ...draft, key: e.target.value })} /></div>
        <div><Label>Label</Label><Input value={draft.label ?? ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>
        <div><Label>Typ</Label>
          <Select value={draft.type as string} onValueChange={(v) => setDraft({ ...draft, type: v as CustomFieldType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["text", "number", "date", "checkbox", "select"] as CustomFieldType[]).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Optionen (Komma)</Label><Input value={(draft.options ?? []).join(",")} onChange={(e) => setDraft({ ...draft, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
        <div className="self-end"><Button onClick={add}>+ Feld anlegen</Button></div>
      </CardContent></Card>
      <Card><CardContent className="space-y-2 p-6">
        {(q.data ?? []).map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <span><strong>{f.label}</strong> ({f.key}) · {f.type}{f.showOnSignup ? " · im Anmeldeformular" : ""}</span>
            <Button size="sm" variant="ghost" onClick={async () => { await deleteCustomField(f.id); qc.invalidateQueries(); }}>Löschen</Button>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}