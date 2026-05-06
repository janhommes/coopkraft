import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { listUsers, saveUser, deleteUser } from "@/services/users.service";
import { uid } from "@/services/db";
import { ALL_ROLES, ROLE_LABELS, type AppUser, type Role } from "@/lib/types";

export const Route = createFileRoute("/app/admin/users")({
  component: UsersAdmin,
});

function UsersAdmin() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const add = async () => {
    if (!name || !email) { toast.error("Name und E-Mail sind Pflicht"); return; }
    const u: AppUser = { id: uid(), name, email, roles: ["mitglied"] };
    await saveUser(u); setName(""); setEmail(""); qc.invalidateQueries(); toast.success("Benutzer angelegt");
  };
  const toggle = async (u: AppUser, r: Role) => {
    const roles = u.roles.includes(r) ? u.roles.filter((x) => x !== r) : [...u.roles, r];
    await saveUser({ ...u, roles }); qc.invalidateQueries();
  };
  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-3 p-6 md:grid-cols-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>E-Mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="self-end"><Button onClick={add}>+ Benutzer anlegen</Button></div>
      </CardContent></Card>
      <Card><CardContent className="space-y-3 p-6">
        {(q.data ?? []).map((u) => (
          <div key={u.id} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <div><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
              <Button size="sm" variant="ghost" onClick={async () => { await deleteUser(u.id); qc.invalidateQueries(); }}>Löschen</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs">
                  <Checkbox checked={u.roles.includes(r)} onCheckedChange={() => toggle(u, r)} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}