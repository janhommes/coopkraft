import { getAll, put, del, uid } from "./db";
import type { AppUser, DividendItem, DividendRun, Member, ShareLot } from "@/lib/types";
import { logAudit } from "./audit.service";
import { taxFromMember } from "@/lib/tax";
import { buildCertificatePdf } from "@/lib/dividend-certificate";
import { saveGeneratedDocument, deleteDocument, getDocument } from "./documents.service";
import { getSettings } from "./settings.service";

export const listDividendRuns = (): Promise<DividendRun[]> => getAll<DividendRun>("dividends");

/** Berechnet Dividende anteilig zur Haltedauer pro Lot innerhalb des Geschäftsjahres */
/** Brutto-Berechnung pro Lot (ohne Steuer). Bleibt für Vorschauen erhalten. */
export function calcDividend(
  lots: ShareLot[],
  fiscalYear: number,
  ratePercent: number,
): { items: DividendItem[]; total: number } {
  const yearStart = new Date(fiscalYear, 0, 1);
  const yearEnd = new Date(fiscalYear, 11, 31);
  const yearDays = 365;
  const items: DividendItem[] = [];
  for (const lot of lots) {
    if (lot.status !== "active" && lot.status !== "terminating" && lot.status !== "repaid") continue;
    const start = new Date(Math.max(yearStart.getTime(), new Date(lot.signedAt).getTime()));
    const end = lot.payoutDate ? new Date(Math.min(yearEnd.getTime(), new Date(lot.payoutDate).getTime())) : yearEnd;
    if (end < start) continue;
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const capital = lot.count * lot.valuePerShare;
    const amount = +(capital * (ratePercent / 100) * (days / yearDays)).toFixed(2);
    if (amount > 0) items.push({ memberId: lot.memberId, lotId: lot.id, days, amount, gross: amount });
  }
  const total = +items.reduce((s, i) => s + i.amount, 0).toFixed(2);
  return { items, total };
}

/** Wendet Steuern pro Mitglied an und reichert Items + totals an. */
export function applyTaxes(
  items: DividendItem[],
  members: Member[],
): { items: DividendItem[]; totals: NonNullable<DividendRun["totals"]> } {
  const memberMap = new Map(members.map((m) => [m.id, m] as const));
  // Brutto pro Mitglied summieren, Steuern darauf berechnen, dann anteilig
  // pro Item zurückverteilen, damit Lot-genaue Aufteilung erhalten bleibt.
  const grossByMember = new Map<string, number>();
  for (const it of items) {
    grossByMember.set(it.memberId, (grossByMember.get(it.memberId) ?? 0) + it.amount);
  }
  const taxByMember = new Map<string, ReturnType<typeof taxFromMember>>();
  for (const [mid, gross] of grossByMember) {
    const m = memberMap.get(mid);
    if (!m) continue;
    taxByMember.set(mid, taxFromMember(m, gross));
  }
  const enriched: DividendItem[] = items.map((it) => {
    const memberGross = grossByMember.get(it.memberId) ?? 0;
    const t = taxByMember.get(it.memberId);
    if (!t || memberGross <= 0) {
      return { ...it, gross: it.amount, kapest: 0, soli: 0, kist: 0, net: it.amount, freigestellt: false, kistRate: 0 };
    }
    const share = it.amount / memberGross;
    const kapest = +(t.kapest * share).toFixed(2);
    const soli = +(t.soli * share).toFixed(2);
    const kist = +(t.kist * share).toFixed(2);
    const net = +(it.amount - kapest - soli - kist).toFixed(2);
    return {
      ...it,
      gross: it.amount,
      kapest,
      soli,
      kist,
      net,
      freigestellt: t.freigestellt,
      kistRate: t.kistRate,
    };
  });
  const totals = enriched.reduce(
    (a, i) => ({
      gross: +(a.gross + (i.gross ?? 0)).toFixed(2),
      kapest: +(a.kapest + (i.kapest ?? 0)).toFixed(2),
      soli: +(a.soli + (i.soli ?? 0)).toFixed(2),
      kist: +(a.kist + (i.kist ?? 0)).toFixed(2),
      net: +(a.net + (i.net ?? 0)).toFixed(2),
    }),
    { gross: 0, kapest: 0, soli: 0, kist: 0, net: 0 },
  );
  return { items: enriched, totals };
}

export async function createDividendRun(
  fiscalYear: number,
  ratePercent: number,
  user: AppUser,
): Promise<DividendRun> {
  const [lots, members, settings] = await Promise.all([
    getAll<ShareLot>("shareLots"),
    getAll<Member>("members"),
    getSettings(),
  ]);
  const memberMap = new Map(members.map((m) => [m.id, m] as const));
  const base = calcDividend(lots, fiscalYear, ratePercent);
  const { items, totals } = applyTaxes(base.items, members);

  // Items pro Mitglied gruppieren und PDFs erzeugen
  const itemsByMember = new Map<string, DividendItem[]>();
  for (const it of items) {
    const arr = itemsByMember.get(it.memberId) ?? [];
    arr.push(it);
    itemsByMember.set(it.memberId, arr);
  }
  const certificates: Record<string, string> = {};
  for (const [mid, mItems] of itemsByMember) {
    const member = memberMap.get(mid);
    if (!member) continue;
    const lotLines = mItems
      .map((it) => {
        const lot = lots.find((l) => l.id === it.lotId);
        if (!lot) return null;
        return { lot, days: it.days, gross: it.amount };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (lotLines.length === 0) continue;
    try {
      const blob = buildCertificatePdf({
        member,
        fiscalYear,
        ratePercent,
        lots: lotLines,
        aussteller: settings?.genossenschaft,
        ausstellerName: settings?.genossenschaft?.name || settings?.genossenschaftsName || "Genossenschaft",
        logoDataUrl: settings?.logoDataUrl,
      });
      const fileName = `Steuerbescheinigung_${fiscalYear}_${member.mitgliedsnummer}.pdf`;
      const rec = await saveGeneratedDocument(
        {
          memberId: member.id,
          title: `Steuerbescheinigung Dividende GJ ${fiscalYear}`,
          description: `Automatisch erzeugt beim Dividendenlauf vom ${new Date().toLocaleDateString("de-DE")}`,
          category: "Steuerbescheinigung",
          visibility: "internal",
          visibleToMember: true,
          fileName,
          mimeType: "application/pdf",
        },
        blob,
        user,
      );
      certificates[mid] = rec.id;
    } catch (e) {
      console.error("Bescheinigung fehlgeschlagen für Mitglied", mid, e);
    }
  }

  const run: DividendRun = {
    id: uid(),
    fiscalYear,
    ratePercent,
    createdAt: new Date().toISOString(),
    createdBy: user.name,
    items,
    totalAmount: base.total,
    totals,
    certificates,
  };
  await put("dividends", run);
  const certCount = Object.keys(certificates).length;
  await logAudit(
    user,
    "Dividendenlauf erstellt",
    `GJ ${fiscalYear} · ${ratePercent}% · Brutto ${totals.gross.toFixed(2)} € · Netto ${totals.net.toFixed(2)} € · ${certCount} Bescheinigungen`,
  );
  return run;
}

export async function aggregateByMember(items: DividendRun["items"]): Promise<{ member: Member; total: number }[]> {
  const members = await getAll<Member>("members");
  const map = new Map<string, number>();
  for (const it of items) map.set(it.memberId, (map.get(it.memberId) ?? 0) + it.amount);
  const out: { member: Member; total: number }[] = [];
  for (const [mid, total] of map.entries()) {
    const m = members.find((x) => x.id === mid);
    if (m) out.push({ member: m, total: +total.toFixed(2) });
  }
  return out.sort((a, b) => b.total - a.total);
}

/** Löscht einen Dividendenlauf vollständig. */
export async function deleteDividendRun(runId: string, user: AppUser): Promise<void> {
  const all = await listDividendRuns();
  const run = all.find((r) => r.id === runId);
  if (!run) throw new Error("Dividendenlauf nicht gefunden");
  // Zugehörige Bescheinigungen mit löschen
  const certIds = Object.values(run.certificates ?? {});
  for (const docId of certIds) {
    const doc = await getDocument(docId);
    if (doc) {
      try {
        await deleteDocument(docId, user);
      } catch (e) {
        console.error("Bescheinigung löschen fehlgeschlagen", docId, e);
      }
    }
  }
  await del("dividends", runId);
  await logAudit(
    user,
    "Dividendenlauf gelöscht",
    `GJ ${run.fiscalYear} · ${run.ratePercent}% · ${run.totalAmount.toFixed(2)} € (${certIds.length} Bescheinigungen entfernt)`,
  );
}

/** Liefert pro Lauf die Summe und die zugehörigen Items für ein Mitglied. */
export async function dividendsByMember(
  memberId: string,
): Promise<{ run: DividendRun; total: number; items: DividendRun["items"] }[]> {
  const runs = await listDividendRuns();
  const out: { run: DividendRun; total: number; items: DividendRun["items"] }[] = [];
  for (const r of runs) {
    const items = r.items.filter((i) => i.memberId === memberId);
    if (items.length === 0) continue;
    const total = +items.reduce((s, i) => s + i.amount, 0).toFixed(2);
    out.push({ run: r, total, items });
  }
  return out.sort((a, b) => b.run.fiscalYear - a.run.fiscalYear);
}