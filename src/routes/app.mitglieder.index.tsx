import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMembers } from "@/services/members.service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { can } from "@/lib/permissions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/locale";
import type { MemberStatus } from "@/lib/types";

export const Route = createFileRoute("/app/mitglieder/")({
  component: MembersPage,
});

const STATUS_COLORS: Record<MemberStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700",
  active: "bg-emerald-500/15 text-emerald-700",
  terminating: "bg-orange-500/15 text-orange-700",
  terminated: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

function MembersPage() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const [filter, setFilter] = useState<MemberStatus | "all">("all");
  const [search, setSearch] = useState("");
  const list = (q.data ?? [])
    .filter((m) => filter === "all" || m.status === filter)
    .filter((m) => {
      const s = search.toLowerCase();
      if (!s) return true;
      return [m.vorname, m.nachname, m.email, String(m.mitgliedsnummer)].some((x) => x.toLowerCase().includes(s));
    })
    .sort((a, b) => b.mitgliedsnummer - a.mitgliedsnummer);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mitglieder</h1>
        {can(user, "create:member") && (
          <Button asChild>
            <Link to="/app/mitglieder/neu">+ Neues Mitglied</Link>
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Suche…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {(["all", "pending", "active", "terminating", "terminated", "rejected"] as const).map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "Alle" : s}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Nr.</th>
                <th className="p-3">Name</th>
                <th className="p-3">E-Mail</th>
                <th className="p-3">Ort</th>
                <th className="p-3">Beigetreten</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t hover:bg-accent/40">
                  <td className="p-3 font-mono">{m.mitgliedsnummer}</td>
                  <td className="p-3 font-medium">
                    <Link to="/app/mitglieder/$id" params={{ id: m.id }} className="hover:underline">
                      {m.vorname} {m.nachname}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{m.email}</td>
                  <td className="p-3 text-muted-foreground">{m.ort}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(m.beitrittDatum)}</td>
                  <td className="p-3"><Badge className={STATUS_COLORS[m.status]}>{m.status}</Badge></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Keine Mitglieder</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}