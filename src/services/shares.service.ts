import { getAll, getOne, put, uid } from "./db";
import type { AppUser, ShareLot, ShareTransfer } from "@/lib/types";
import { logAudit } from "./audit.service";

export const listLots = (): Promise<ShareLot[]> => getAll<ShareLot>("shareLots");
export const getLot = (id: string): Promise<ShareLot | undefined> => getOne<ShareLot>("shareLots", id);
export const saveLot = (l: ShareLot): Promise<void> => put("shareLots", l);

export async function lotsByMember(memberId: string): Promise<ShareLot[]> {
  const all = await listLots();
  return all.filter((l) => l.memberId === memberId);
}

export async function activeShareCount(memberId: string): Promise<number> {
  const lots = await lotsByMember(memberId);
  return lots.filter((l) => l.status === "active" || l.status === "terminating").reduce((s, l) => s + l.count, 0);
}

export async function createLot(
  memberId: string,
  count: number,
  valuePerShare: number,
  user: AppUser | null,
  paid = false,
): Promise<ShareLot> {
  const lot: ShareLot = {
    id: uid(),
    memberId,
    count,
    valuePerShare,
    signedAt: new Date().toISOString().slice(0, 10),
    status: paid ? "active" : "pending_payment",
    paidAt: paid ? new Date().toISOString().slice(0, 10) : undefined,
  };
  await saveLot(lot);
  await logAudit(user, "Anteile gezeichnet", `${count} × ${valuePerShare} €`, memberId);
  return lot;
}

/** Splittet einen Lot in zwei (für Teilkündigung/Teilübertragung) */
export async function splitLot(lotId: string, splitCount: number): Promise<{ original: ShareLot; split: ShareLot }> {
  const lot = await getLot(lotId);
  if (!lot) throw new Error("Lot nicht gefunden");
  if (splitCount <= 0 || splitCount >= lot.count) throw new Error("Ungültige Splitting-Anzahl");
  const updated: ShareLot = { ...lot, count: lot.count - splitCount };
  const newLot: ShareLot = { ...lot, id: uid(), count: splitCount, sourceLotId: lot.id };
  await saveLot(updated);
  await saveLot(newLot);
  return { original: updated, split: newLot };
}

// Transfers
export const listTransfers = (): Promise<ShareTransfer[]> => getAll<ShareTransfer>("shareTransfers");
export const saveTransfer = (t: ShareTransfer): Promise<void> => put("shareTransfers", t);

export async function requestTransfer(
  data: Omit<ShareTransfer, "id" | "status" | "requestedAt">,
  user: AppUser,
): Promise<ShareTransfer> {
  const t: ShareTransfer = {
    ...data,
    id: uid(),
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  await saveTransfer(t);
  await logAudit(user, t.kind === "sale" ? "Anteilsverkauf beantragt" : "Anteilsspende beantragt", `${t.count} Anteile → Mitglied ${t.toMemberId.slice(0, 6)}`, t.fromMemberId);
  return t;
}

export async function approveTransfer(transferId: string, user: AppUser): Promise<void> {
  const all = await listTransfers();
  const t = all.find((x) => x.id === transferId);
  if (!t) throw new Error("Übertragung nicht gefunden");
  if (t.status !== "pending") return;

  const sourceLot = await getLot(t.fromLotId);
  if (!sourceLot) throw new Error("Quell-Lot fehlt");
  let usedLot = sourceLot;
  if (sourceLot.count > t.count) {
    const { split } = await splitLot(sourceLot.id, t.count);
    usedLot = split;
  }
  // Quell-Lot als transferred markieren
  await saveLot({ ...usedLot, status: "transferred" });
  // Neuen Lot beim Empfänger anlegen (sofort active)
  const newLot: ShareLot = {
    id: uid(),
    memberId: t.toMemberId,
    count: t.count,
    valuePerShare: usedLot.valuePerShare,
    signedAt: new Date().toISOString().slice(0, 10),
    paidAt: new Date().toISOString().slice(0, 10),
    status: "active",
    sourceLotId: usedLot.id,
  };
  await saveLot(newLot);
  await saveTransfer({ ...t, status: "approved", approvedBy: user.id, approvedAt: new Date().toISOString() });
  await logAudit(user, t.kind === "sale" ? "Anteilsverkauf bestätigt" : "Anteilsspende bestätigt", `${t.count} Anteile`, t.fromMemberId);
  await logAudit(user, t.kind === "sale" ? "Anteile erhalten (Kauf)" : "Anteile erhalten (Spende)", `${t.count} Anteile`, t.toMemberId);
}

export async function rejectTransfer(transferId: string, user: AppUser, reason?: string): Promise<void> {
  const all = await listTransfers();
  const t = all.find((x) => x.id === transferId);
  if (!t || t.status !== "pending") return;
  await saveTransfer({ ...t, status: "rejected", approvedBy: user.id, approvedAt: new Date().toISOString() });
  await logAudit(user, "Anteilsübertragung abgelehnt", reason, t.fromMemberId);
}