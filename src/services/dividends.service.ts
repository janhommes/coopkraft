import { getAll, put, uid } from "./db";
import type { AppUser, DividendRun, Member, ShareLot } from "@/lib/types";
import { logAudit } from "./audit.service";

export const listDividendRuns = (): Promise<DividendRun[]> => getAll<DividendRun>("dividends");

/** Berechnet Dividende anteilig zur Haltedauer pro Lot innerhalb des Geschäftsjahres */
export function calcDividend(
  lots: ShareLot[],
  fiscalYear: number,
  ratePercent: number,
): { items: DividendRun["items"]; total: number } {
  const yearStart = new Date(fiscalYear, 0, 1);
  const yearEnd = new Date(fiscalYear, 11, 31);
  const yearDays = 365;
  const items: DividendRun["items"] = [];
  for (const lot of lots) {
    if (lot.status !== "active" && lot.status !== "terminating" && lot.status !== "repaid") continue;
    const start = new Date(Math.max(yearStart.getTime(), new Date(lot.signedAt).getTime()));
    const end = lot.payoutDate ? new Date(Math.min(yearEnd.getTime(), new Date(lot.payoutDate).getTime())) : yearEnd;
    if (end < start) continue;
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const capital = lot.count * lot.valuePerShare;
    const amount = +(capital * (ratePercent / 100) * (days / yearDays)).toFixed(2);
    if (amount > 0) items.push({ memberId: lot.memberId, lotId: lot.id, days, amount });
  }
  const total = +items.reduce((s, i) => s + i.amount, 0).toFixed(2);
  return { items, total };
}

export async function createDividendRun(
  fiscalYear: number,
  ratePercent: number,
  user: AppUser,
): Promise<DividendRun> {
  const lots = await getAll<ShareLot>("shareLots");
  const { items, total } = calcDividend(lots, fiscalYear, ratePercent);
  const run: DividendRun = {
    id: uid(),
    fiscalYear,
    ratePercent,
    createdAt: new Date().toISOString(),
    createdBy: user.name,
    items,
    totalAmount: total,
  };
  await put("dividends", run);
  await logAudit(user, "Dividendenlauf erstellt", `${fiscalYear} – ${ratePercent}% – ${total.toFixed(2)} €`);
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