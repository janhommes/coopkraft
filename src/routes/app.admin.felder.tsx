import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [editing, setEditing] = useState<Record<string, CustomFieldDef>>({});

  const add = async () => {
    if (!draft.key || !draft.label) { toast.error("Schlüssel und Label sind Pflicht"); return; }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(draft.key)) { toast.error("Schlüssel: nur Buchstaben/Ziffern/Unterstrich, beginnend mit Buchstaben"); return; }
    const f: CustomFieldDef = {
      id: uid(),
      key: draft.key!,
      label: draft.label!,
      type: (draft.type ?? "text") as CustomFieldType,
      required: !!draft.required,
      showOnSignup: !!draft.showOnSignup,
      options: draft.options,
    };
    await saveCustomField(f);
    setDraft({ type: "text", required: false, showOnSignup: true });
    qc.invalidateQueries();
    toast.success("Feld angelegt");
  };

  const startEdit = (f: CustomFieldDef) => setEditing((s) => ({ ...s, [f.id]: { ...f } }));
  const cancelEdit = (id: string) => setEditing((s) => { const c = { ...s }; delete c[id]; return c; });
  const saveEdit = async (id: string) => {
    const f = editing[id];
    if (!f) return;
    if (!f.label.trim()) { toast.error("Label darf nicht leer sein"); return; }
    await saveCustomField(f);
    cancelEdit(id);
    qc.invalidateQueries();
    toast.success("Feld gespeichert");
  };
  const remove = async (f: CustomFieldDef) => {
    if (!window.confirm(`Feld "${f.label}" wirklich löschen?`)) return;
    try {
      await deleteCustomField(f.id);
      qc.invalidateQueries();
      toast.success("Feld gelöscht");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const fields = [...(q.data ?? [])].sort((a, b) => Number(!!b.system) - Number(!!a.system) || a.label.localeCompare(b.label));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-semibold">Neues Feld anlegen</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <div><Label>Schlüssel</Label><Input value={draft.key ?? ""} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="z.B. lieblingsfarbe" /></div>
            <div><Label>Label</Label><Input value={draft.label ?? ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>
            <div><Label>Typ</Label>
              <Select value={draft.type as string} onValueChange={(v) => setDraft({ ...draft, type: v as CustomFieldType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["text", "number", "date", "checkbox", "select"] as CustomFieldType[]).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Optionen (Komma)</Label><Input value={(draft.options ?? []).join(",")} onChange={(e) => setDraft({ ...draft, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} disabled={draft.type !== "select"} /></div>
            <div className="self-end"><Button onClick={add} className="w-full">+ Anlegen</Button></div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!draft.required} onCheckedChange={(c) => setDraft({ ...draft, required: !!c })} />
              Pflichtfeld
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!draft.showOnSignup} onCheckedChange={(c) => setDraft({ ...draft, showOnSignup: !!c })} />
              Im Anmeldeformular zeigen
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-6">
          <h2 className="text-sm font-semibold">Bestehende Felder</h2>
          {fields.length === 0 && <p className="text-sm text-muted-foreground">Keine Felder vorhanden.</p>}
          {fields.map((f) => {
            const e = editing[f.id];
            if (e) {
              return (
                <div key={f.id} className="space-y-2 rounded border p-3 text-sm">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <Label className="text-xs">Schlüssel</Label>
                      <Input value={e.key} disabled />
                    </div>
                    <div>
                      <Label className="text-xs">Label</Label>
                      <Input value={e.label} onChange={(ev) => setEditing((s) => ({ ...s, [f.id]: { ...e, label: ev.target.value } }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Typ</Label>
                      <Input value={e.type} disabled />
                    </div>
                    <div>
                      <Label className="text-xs">Optionen (Komma)</Label>
                      <Input
                        value={(e.options ?? []).join(",")}
                        disabled={e.type !== "select"}
                        onChange={(ev) => setEditing((s) => ({ ...s, [f.id]: { ...e, options: ev.target.value.split(",").map((x) => x.trim()).filter(Boolean) } }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2">
                        <Checkbox checked={e.required} onCheckedChange={(c) => setEditing((s) => ({ ...s, [f.id]: { ...e, required: !!c } }))} />
                        Pflichtfeld
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={e.showOnSignup} onCheckedChange={(c) => setEditing((s) => ({ ...s, [f.id]: { ...e, showOnSignup: !!c } }))} />
                        Im Anmeldeformular
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => cancelEdit(f.id)}>Abbrechen</Button>
                      <Button size="sm" onClick={() => saveEdit(f.id)}>Speichern</Button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{f.label}</strong>
                    <span className="text-xs text-muted-foreground">({f.key} · {f.type})</span>
                    {f.system && <Badge variant="secondary" className="text-xs">System</Badge>}
                    {f.required && <Badge className="text-xs">Pflicht</Badge>}
                    {f.showOnSignup && <Badge variant="outline" className="text-xs">Anmeldung</Badge>}
                  </div>
                  {f.type === "select" && f.options && f.options.length > 0 && (
                    <div className="text-xs text-muted-foreground">Optionen: {f.options.join(", ")}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(f)}>Bearbeiten</Button>
                  {!f.system && (
                    <Button size="sm" variant="ghost" onClick={() => remove(f)}>Löschen</Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}