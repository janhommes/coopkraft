import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMembers, listApprovals, listPaymentConfirmations } from "@/services/members.service";
import { listLots } from "@/services/shares.service";
import { listTerminations } from "@/services/terminations.service";
import { listDividendRuns } from "@/services/dividends.service";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatDate } from "@/lib/locale";
import { useBranding } from "@/components/providers/BrandingProvider";
import { ROLE_LABELS } from "@/lib/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { Member, ShareLot } from "@/lib/types";

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
  const divQ = useQuery({ queryKey: ["dividends"], queryFn: listDividendRuns });

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

  const showVorstandCharts = user.roles.some((r) => r === "vorstand" || r === "aufsichtsrat" || r === "admin");
  const memberSeries = showVorstandCharts ? buildMemberGrowthSeries(members) : [];
  const capitalSeries = showVorstandCharts ? buildCapitalSeries(lots) : [];
  const dividendRuns = (divQ.data ?? []).slice().sort((a, b) => a.fiscalYear - b.fiscalYear);
  const totalDividends = dividendRuns.reduce((s, r) => s + r.totalAmount, 0);

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
        {showVorstandCharts && (
          <KPI
            label="Dividenden ausgeschüttet"
            value={formatEuro(totalDividends)}
            sub={`${dividendRuns.length} Lauf/Läufe`}
          />
        )}
      </div>

      {showVorstandCharts && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mitgliederzuwachs</CardTitle>
              <p className="text-xs text-muted-foreground">Kumulative Anzahl aktiver Mitglieder über die Zeit</p>
            </CardHeader>
            <CardContent>
              {memberSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Daten vorhanden.</p>
              ) : (
                <ChartContainer
                  className="h-[280px] w-full"
                  config={{ members: { label: "Mitglieder", color: "var(--primary)" } }}
                >
                  <AreaChart data={memberSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="memberFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-members)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--color-members)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Area
                      type="monotone"
                      dataKey="members"
                      stroke="var(--color-members)"
                      strokeWidth={2}
                      fill="url(#memberFill)"
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kapitalentwicklung</CardTitle>
              <p className="text-xs text-muted-foreground">Gezeichnetes Kapital aktiver Anteile über die Zeit</p>
            </CardHeader>
            <CardContent>
              {capitalSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Daten vorhanden.</p>
              ) : (
                <ChartContainer
                  className="h-[280px] w-full"
                  config={{ capital: { label: "Kapital", color: "var(--primary)" } }}
                >
                  <LineChart data={capitalSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tickFormatter={(v: number) => formatEuroCompact(v)}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          formatter={(value) => formatEuro(Number(value))}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="capital"
                      stroke="var(--color-capital)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function fillMonths(start: string, end: string): string[] {
  const out: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function buildMemberGrowthSeries(members: Member[]): { label: string; members: number }[] {
  const dates = members
    .map((m) => m.beitrittDatum || m.createdAt?.slice(0, 10))
    .filter((d): d is string => Boolean(d));
  if (dates.length === 0) return [];
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const today = new Date().toISOString().slice(0, 10);
  const months = fillMonths(monthKey(min), monthKey(today));

  // Zähle Beitritte pro Monat (nur aktive bzw. jemals aktiv gewordene Mitglieder werden mitgenommen,
  // wir nutzen alle mit Beitrittsdatum als beste Annäherung)
  const additions = new Map<string, number>();
  for (const m of members) {
    const d = m.beitrittDatum || m.createdAt?.slice(0, 10);
    if (!d) continue;
    const k = monthKey(d);
    additions.set(k, (additions.get(k) ?? 0) + 1);
  }
  let cum = 0;
  return months.map((k) => {
    cum += additions.get(k) ?? 0;
    return { label: monthLabel(k), members: cum };
  });
}

function buildCapitalSeries(lots: ShareLot[]): { label: string; capital: number }[] {
  // Nur Lots, die irgendwann aktiv geworden sind
  const events: { date: string; delta: number }[] = [];
  for (const l of lots) {
    const start = l.paidAt || (l.status === "active" || l.status === "terminating" ? l.signedAt : undefined);
    if (!start) continue;
    const value = l.count * l.valuePerShare;
    events.push({ date: start, delta: value });
    // Bei Rückzahlung/Übertragung Kapital wieder abziehen
    if ((l.status === "repaid" || l.status === "transferred") && l.payoutDate) {
      events.push({ date: l.payoutDate, delta: -value });
    }
  }
  if (events.length === 0) return [];
  const min = events.reduce((a, b) => (a.date < b.date ? a : b)).date;
  const today = new Date().toISOString().slice(0, 10);
  const months = fillMonths(monthKey(min), monthKey(today));

  const deltas = new Map<string, number>();
  for (const e of events) {
    const k = monthKey(e.date);
    deltas.set(k, (deltas.get(k) ?? 0) + e.delta);
  }
  let cum = 0;
  return months.map((k) => {
    cum += deltas.get(k) ?? 0;
    return { label: monthLabel(k), capital: Math.max(0, cum) };
  });
}

function formatEuroCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " M€";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " k€";
  return v.toLocaleString("de-DE") + " €";
}