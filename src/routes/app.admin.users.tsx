import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listUsers, saveUser, deleteUser } from "@/services/users.service";
import { listMembers } from "@/services/members.service";
import { getSsoConfig, saveSsoConfig } from "@/services/settings.service";
import { resolveRoles, type SsoRoleConfig } from "@/lib/sso";
import { uid } from "@/services/db";
import { ALL_ROLES, ROLE_LABELS, type AppUser, type Role } from "@/lib/types";

export const Route = createFileRoute("/app/admin/users")({
  component: RolesAdmin,
});

const ROLE_DESC: Record<Role, string> = {
  mitglied: "Eigene Daten, Anteile, Dokumente und Kündigung",
  mitgliederverwalter: "Mitglieder anlegen, pflegen, Dokumente, Kündigungen",
  vorstand: "Übersicht, Freigaben, Dividendenläufe",
  aufsichtsrat: "Lesender Einblick und Kennzahlen",
  mitgliedsbestaetiger: "Beitritte bestätigen",
  zahlungspruefer: "Zahlungseingänge prüfen",
  kommunikation: "Newsletter und Kampagnen",
  auszahler: "SEPA-Auszahlungen erstellen",
  admin: "Alle Einstellungen",
};

const toggleRole = (roles: Role[], r: Role) => (roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);

function RolesAdmin() {
  const qc = useQueryClient();
  const cfgQ = useQuery({ queryKey: ["ssoConfig"], queryFn: getSsoConfig });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const [cfg, setCfg] = useState<SsoRoleConfig | null>(null);
  useEffect(() => { if (cfgQ.data && !cfg) setCfg(cfgQ.data); }, [cfgQ.data, cfg]);

  const [testEmail, setTestEmail] = useState("anna@demo.de");
  const [testGroups, setTestGroups] = useState("egv-vorstand");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [groups, setGroups] = useState("");

  if (!cfg) return null;

  const save = async () => { await saveSsoConfig(cfg); qc.invalidateQueries(); toast.success("Zuordnung gespeichert"); };
  const updMap = (i: number, patch: Partial<SsoRoleConfig["mappings"][number]>) =>
    setCfg({ ...cfg, mappings: cfg.mappings.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const parseGroups = (s: string) => s.split(",").map((g) => g.trim()).filter(Boolean);
  const test = resolveRoles({ email: testEmail, groups: parseGroups(testGroups) }, cfg, membersQ.data ?? []);

  const addUser = async () => {
    if (!name || !email) { toast.error("Name und E-Mail sind Pflicht"); return; }
    await saveUser({ id: uid(), name, email, roles: [], groups: parseGroups(groups) });
    setName(""); setEmail(""); setGroups(""); qc.invalidateQueries(); toast.success("Testperson angelegt");
  };
  const updUser = async (u: AppUser, patch: Partial<AppUser>) => { await saveUser({ ...u, ...patch }); qc.invalidateQueries(); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SSO-Gruppen → Rollen</CardTitle>
          <CardDescription>
            Wer sich anmeldet und welchen Gruppen er angehört, liefert der SSO-Anbieter. Hier legst du nur fest, welche Gruppe welche Rollen bekommt.
            Die Rolle „Mitglied“ wird automatisch vergeben, wenn die Login-E-Mail zu einem aktiven Mitglied passt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Gruppen-Claim im Token</Label><Input value={cfg.claim} onChange={(e) => setCfg({ ...cfg, claim: e.target.value })} /></div>
            <div>
              <Label>Ohne passende Gruppe und ohne Mitgliedschaft</Label>
              <Select value={cfg.unknownPolicy} onValueChange={(v) => setCfg({ ...cfg, unknownPolicy: v as SsoRoleConfig["unknownPolicy"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deny">Kein Zugang</SelectItem>
                  <SelectItem value="mitglied">Als Mitglied zulassen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {cfg.mappings.map((m, i) => (
            <div key={i} className="rounded border p-3">
              <div className="flex gap-2">
                <Input placeholder="Gruppenname, z. B. egv-vorstand" value={m.group} onChange={(e) => updMap(i, { group: e.target.value })} />
                <Button variant="ghost" onClick={() => setCfg({ ...cfg, mappings: cfg.mappings.filter((_, j) => j !== i) })}>Entfernen</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_ROLES.filter((r) => r !== "mitglied").map((r) => (
                  <label key={r} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
                    <Checkbox checked={m.roles.includes(r)} onCheckedChange={() => updMap(i, { roles: toggleRole(m.roles, r) })} />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCfg({ ...cfg, mappings: [...cfg.mappings, { group: "", roles: [] }] })}>+ Gruppe</Button>
            <Button onClick={save}>Speichern</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Zuordnung testen</CardTitle><CardDescription>Berechnet live mit den (noch ungespeicherten) Einstellungen.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div><Label>E-Mail</Label><Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} /></div>
          <div><Label>Gruppen (kommagetrennt)</Label><Input value={testGroups} onChange={(e) => setTestGroups(e.target.value)} /></div>
          <div className="flex flex-wrap gap-1 md:col-span-2">
            {test.roles.length === 0 ? <span className="text-sm text-muted-foreground">Kein Zugang</span> :
              test.roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rollen-Übersicht</CardTitle></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <div key={r} className="rounded border p-2 text-sm"><div className="font-medium">{ROLE_LABELS[r]}</div><div className="text-xs text-muted-foreground">{ROLE_DESC[r]}</div></div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testpersonen & Ausnahmen</CardTitle>
          <CardDescription>
            Nur für diese Demo bzw. Notfälle: Testpersonen simulieren einen SSO-Login mit Gruppen. „Zusätzliche Rollen“ gelten unabhängig vom SSO (z. B. für den ersten Admin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>E-Mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Gruppen</Label><Input value={groups} onChange={(e) => setGroups(e.target.value)} placeholder="egv-vorstand, …" /></div>
            <div className="self-end"><Button onClick={addUser}>+ Testperson</Button></div>
          </div>
          {(usersQ.data ?? []).map((u) => {
            const eff = resolveRoles({ email: u.email, groups: u.groups ?? [] }, cfg, membersQ.data ?? [], u.roles);
            return (
              <div key={u.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                  <Button size="sm" variant="ghost" onClick={async () => { await deleteUser(u.id); qc.invalidateQueries(); }}>Löschen</Button>
                </div>
                <div className="mt-2"><Label className="text-xs">SSO-Gruppen</Label>
                  <Input defaultValue={(u.groups ?? []).join(", ")} onBlur={(e) => updUser(u, { groups: parseGroups(e.target.value) })} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Zusätzliche Rollen (Ausnahme):</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ALL_ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
                      <Checkbox checked={u.roles.includes(r)} onCheckedChange={() => updUser(u, { roles: toggleRole(u.roles, r) })} />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Ergebnis:</span>
                  {eff.roles.length === 0 ? <span>Kein Zugang</span> : eff.roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{ROLE_LABELS[r]}</Badge>)}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
