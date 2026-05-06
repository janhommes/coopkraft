import { getAll, getOne, put, uid } from "./db";
import type { AppUser, Approval, Member, MemberStatus, PaymentConfirmation } from "@/lib/types";
import { logAudit } from "./audit.service";
import { getWorkflow } from "./settings.service";

export const listMembers = (): Promise<Member[]> => getAll<Member>("members");
export const getMember = (id: string): Promise<Member | undefined> => getOne<Member>("members", id);
export const saveMember = (m: Member): Promise<void> => put("members", m);

export async function nextMitgliedsnummer(): Promise<number> {
  const all = await listMembers();
  return (all.reduce((m, x) => Math.max(m, x.mitgliedsnummer), 1000) ?? 1000) + 1;
}

export async function createMember(
  data: Omit<Member, "id" | "mitgliedsnummer" | "createdAt" | "updatedAt" | "status"> & {
    status?: MemberStatus;
  },
  user: AppUser | null,
): Promise<Member> {
  const now = new Date().toISOString();
  const m: Member = {
    ...data,
    id: uid(),
    mitgliedsnummer: await nextMitgliedsnummer(),
    status: data.status ?? "pending",
    createdAt: now,
    updatedAt: now,
  };
  await saveMember(m);
  await logAudit(user, "Mitglied angelegt", `${m.vorname} ${m.nachname}`, m.id);
  return m;
}

export const listApprovals = (): Promise<Approval[]> => getAll<Approval>("approvals");
export const listPaymentConfirmations = (): Promise<PaymentConfirmation[]> =>
  getAll<PaymentConfirmation>("paymentConfirmations");

/**
 * Prüft, ob ein Mitglied alle konfigurierten Beitritts-Bedingungen erfüllt
 * und setzt ggf. Status auf "active".
 */
export async function recomputeMemberStatus(memberId: string, user: AppUser | null): Promise<Member | undefined> {
  const member = await getMember(memberId);
  if (!member) return undefined;
  if (member.status !== "pending") return member;
  const wf = await getWorkflow();
  if (!wf) return member;
  const approvals = (await listApprovals()).filter((a) => a.memberId === memberId && a.decision === "approve");
  const confirmers = approvals.filter((a) => a.role === "mitgliedsbestaetiger");
  const aufsicht = approvals.filter((a) => a.role === "aufsichtsrat");
  const payments = (await listPaymentConfirmations()).filter((p) => p.memberId === memberId);

  const okApprovers = confirmers.length >= wf.beitritt.anzahlBestaetigungen;
  const okAufsicht = !wf.beitritt.aufsichtsratPflicht || aufsicht.length >= wf.beitritt.aufsichtsratAnzahl;
  const okZahlung = !wf.beitritt.zahlungPflicht || payments.length > 0;

  if (okApprovers && okAufsicht && okZahlung) {
    const updated: Member = {
      ...member,
      status: "active",
      beitrittDatum: member.beitrittDatum ?? new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    await saveMember(updated);
    await logAudit(user, "Mitglied aktiviert", "Alle Beitrittsbedingungen erfüllt", memberId);
    return updated;
  }
  return member;
}

export async function approveMembership(
  memberId: string,
  user: AppUser,
  role: "mitgliedsbestaetiger" | "aufsichtsrat",
  decision: "approve" | "reject",
  reason?: string,
): Promise<void> {
  const wf = await getWorkflow();
  const member = await getMember(memberId);
  if (!member) throw new Error("Mitglied nicht gefunden");
  if (wf?.beitritt.verhindereSelfApproval && user.memberId === memberId)
    throw new Error("Self-Approval ist verboten");
  if (wf?.beitritt.verhindereDoppelapproval) {
    const existing = (await listApprovals()).filter((a) => a.memberId === memberId && a.userId === user.id);
    if (existing.length > 0) throw new Error("Du hast dieses Mitglied bereits bewertet");
  }
  const a: Approval = {
    id: uid(),
    memberId,
    userId: user.id,
    userName: user.name,
    role,
    decision,
    reason,
    at: new Date().toISOString(),
  };
  await put("approvals", a);
  await logAudit(user, decision === "approve" ? `Beitritt bestätigt (${role})` : `Beitritt abgelehnt (${role})`, reason, memberId);

  if (decision === "reject") {
    await saveMember({ ...member, status: "rejected", updatedAt: new Date().toISOString(), kuendigungsgrund: reason });
    return;
  }
  await recomputeMemberStatus(memberId, user);
}

export async function confirmPayment(
  memberId: string,
  lotId: string,
  amount: number,
  user: AppUser,
): Promise<void> {
  const p: PaymentConfirmation = {
    id: uid(),
    memberId,
    lotId,
    userId: user.id,
    userName: user.name,
    amount,
    at: new Date().toISOString(),
  };
  await put("paymentConfirmations", p);
  await logAudit(user, "Zahlung bestätigt", `Lot ${lotId.slice(0, 6)} – ${amount} €`, memberId);
  // Lot auf "active" setzen
  const lot = await getOne<import("@/lib/types").ShareLot>("shareLots", lotId);
  if (lot && lot.status === "pending_payment") {
    await put("shareLots", { ...lot, status: "active", paidAt: new Date().toISOString().slice(0, 10) });
  }
  await recomputeMemberStatus(memberId, user);
}