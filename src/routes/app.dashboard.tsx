import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMembers, listApprovals, listPaymentConfirmations } from "@/services/members.service";
import { listLots } from "@/services/shares.service";
import { listTerminations } from "@/services/terminations.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatDate } from "@/lib/locale";
import { useBranding } from "@/components/providers/BrandingProvider";
import { ROLE_LABELS } from "@/lib/types";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useBranding();
  const membersQ = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const lotsQ = useQuery({ queryKey: ["lots"], queryFn: listLots });
  const apprQ = useQuery({ queryKey: ["approvals"], queryFn: listApprovals });
  const payQ = useQuery({ queryKey: ["payments"], queryFn: listPaymentConfirmations });
  const termQ = useQuery({ queryKey: ["terminations"], queryFn: listTerminations });

  if (!user) return null;

  // Mitglied-spezifischer View
  if (user.roles.length === 1 && user.roles[0] === "mitglied") {
    const myLots = (lotsQ.data ?? []).filter((l) => l.memberId === user.memberId);
    const myActive = myLots.filter((l) => l.status === "active" || l.status === "terminating");
    const totalShares = myActive.reduce((s, l) => s + l.count, 0);
    const totalValue = myActive.reduce((s, l) => s + l.count * l.valuePerShare, 0);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Willkommen, {user.name}</h1>
        <div className="grid gap-4 md:grid-cols-3">
          <KPI label="Meine Anteile" value={String(totalShares)} />
          <KPI label="Gesamtwert" value={formatEuro(totalValue)} />
          <KPI label="Aktive Lots" value={String(myActive.length)} />
        </div>
        {user.memberId && (
          <Link to="/app/mitglieder/$id" params={{ id: user.memberId }} className="text-sm text-primary underline">
            Zu meinem Profil →
          </Link>
        )}
      </div>
    );
  }

  const members = membersQ.data ?? [];
  const lots = lotsQ.data ?? [];
  const active = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "pending");
  const terminating = members.filter((m) => m.status === "terminating");
  const activeLots = lots.filter((l) => l.status === "active" || l.status === "terminating");
  const totalCapital = activeLots.reduce((s, l) => s + l.count * l.valuePerShare, 0);
  const totalShares = activeLots.reduce((s, l) => s + l.count, 0);

  // Offene Aufgaben
  const myConfirmsToDo = pending.filter((m) => {
    const apprs = (apprQ.data ?? []).filter((a) => a.memberId === m.id && a.userId === user.id);
    return apprs.length === 0;
  });
  const openPayments = lots.filter((l) => l.status === "pending_payment");
  const openTerminations = (termQ.data ?? []).filter((t) => t.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{settings?.genossenschaftsName}</h1>
          <p className="text-sm text-muted-foreground">Übersicht für {user.name}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <Badge key={r} variant="outline">{ROLE_LABELS[r]}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPI label="Aktive Mitglieder" value={String(active.length)} sub={`${members.length} insgesamt`} />
        <KPI label="Gesamtkapital" value={formatEuro(totalCapital)} sub={`${totalShares} Anteile`} />
        <KPI label="Offene Beitritte" value={String(pending.length)} sub="In Bearbeitung" />
        <KPI label="In Kündigung" value={String(terminating.length)} sub={`${openTerminations.length} offene Anträge`} />
        <KPI label="Zahlungen offen" value={String(payQ.data ? openPayments.length : 0)} sub="Erwartete Eingänge" />
        <KPI label="Meine Bestätigungen" value={String(user.roles.includes("mitgliedsbestaetiger") ? myConfirmsToDo.length : 0)} sub="Wartet auf dich" />
      </div>

      {(user.roles.includes("mitgliedsbestaetiger") || user.roles.includes("aufsichtsrat")) && pending.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Offene Beitritte</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.slice(0, 8).map((m) => (
              <Link key={m.id} to="/app/mitglieder/$id" params={{ id: m.id }} className="flex items-center justify-between rounded border p-2 hover:bg-accent">
                <div className="text-sm">
                  <div className="font-medium">{m.vorname} {m.nachname}</div>
                  <div className="text-muted-foreground">Eingegangen {formatDate(m.createdAt)}</div>
                </div>
                <Badge variant="secondary">prüfen</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}