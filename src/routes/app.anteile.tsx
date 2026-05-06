import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLots } from "@/services/shares.service";
import { listMembers } from "@/services/members.service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEuro, lotStatusLabel } from "@/lib/locale";

export const Route = createFileRoute("/app/anteile")({
  component: AnteilePage,
});

function AnteilePage() {
  const lots = useQuery({ queryKey: ["lots"], queryFn: listLots });
  const members = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const memberMap = new Map((members.data ?? []).map((m) => [m.id, m]));
  const list = (lots.data ?? []).slice().sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Anteile</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Mitglied</th><th className="p-3">Anzahl</th><th className="p-3">Wert</th><th className="p-3">Gezeichnet</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const m = memberMap.get(l.memberId);
                return (
                  <tr key={l.id} className="border-t">
                    <td className="p-3">{m ? <Link to="/app/mitglieder/$id" params={{ id: m.id }} className="hover:underline">{m.vorname} {m.nachname}</Link> : "?"}</td>
                    <td className="p-3">{l.count}</td>
                    <td className="p-3">{formatEuro(l.count * l.valuePerShare)}</td>
                    <td className="p-3">{formatDate(l.signedAt)}</td>
                    <td className="p-3"><Badge variant="outline">{lotStatusLabel(l.status)}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}