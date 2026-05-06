import { getAll, put, uid } from "./db";
import type { AppUser, Member, ShareLot, Termination, TerminationTarget } from "@/lib/types";
import { calcEffectiveDate, calcPayoutDate } from "@/lib/termination";
import { getMember, saveMember } from "./members.service";
import { getLot, saveLot, splitLot } from "./shares.service";
import { getSettings, getWorkflow } from "./settings.service";
import { logAudit } from "./audit.service";

export const listTerminations = (): Promise<Termination[]> => getAll<Termination>("terminations");

export async function requestTermination(
  target: TerminationTarget,
  memberId: string,
  user: AppUser,
  opts?: { lotId?: string; shareCount?: number; reason?: string; wishDate?: string },
): Promise<Termination> {
  const wf = await getWorkflow();
  const settings = await getSettings();
  if (!wf || !settings) throw new Error("Konfiguration fehlt");
  const cfg = target === "membership" ? wf.membership : wf.share;

  let signedAt: string;
  if (target === "membership") {
    const m = await getMember(memberId);
    signedAt = m?.beitrittDatum ?? m?.createdAt ?? new Date().toISOString();
  } else {
    if (!opts?.lotId) throw new Error("LotId erforderlich");
    const lot = await getLot(opts.lotId);
    signedAt = lot?.signedAt ?? new Date().toISOString();
  }

  const earliest = calcEffectiveDate(cfg, signedAt);
  const wish = opts?.wishDate ? new Date(opts.wishDate) : earliest;
  const effective = wish > earliest ? wish : earliest;
  const payout = calcPayoutDate(cfg, effective, settings.fiscalYearEndMonth);

  const t: Termination = {
    id: uid(),
    target,
    memberId,
    lotId: opts?.lotId,
    shareCount: opts?.shareCount,
    requestedBy: user.id,
    requestedAt: new Date().toISOString(),
    reason: opts?.reason,
    effectiveDate: effective.toISOString().slice(0, 10),
    payoutDate: payout.toISOString().slice(0, 10),
    status: "pending",
    approvals: [],
  };
  await put("terminations", t);
  await logAudit(user, target === "membership" ? "Mitgliedschaft gekündigt" : "Anteile gekündigt", `Wirksam zum ${t.effectiveDate}`, memberId);
  return t;
}

export async function approveTermination(terminationId: string, user: AppUser): Promise<void> {
  const all = await listTerminations();
  const t = all.find((x) => x.id === terminationId);
  const wf = await getWorkflow();
  if (!t || !wf) throw new Error("Nicht gefunden");
  const cfg = t.target === "membership" ? wf.membership : wf.share;
  // Doppelapproval verhindern
  if (t.approvals.some((a) => a.userId === user.id)) return;
  const myRole = user.roles.find((r) => cfg.bestaetigerRollen.includes(r));
  if (!myRole) throw new Error("Keine berechtigte Rolle");
  const updated: Termination = {
    ...t,
    approvals: [...t.approvals, { userId: user.id, userName: user.name, role: myRole, at: new Date().toISOString() }],
  };
  if (updated.approvals.length >= cfg.anzahlBestaetigungen) {
    updated.status = "approved";
    if (t.target === "membership") {
      const m = await getMember(t.memberId);
      if (m) {
        await saveMember({ ...m, status: "terminating", austrittDatum: t.effectiveDate, updatedAt: new Date().toISOString(), kuendigungsgrund: t.reason });
      }
    } else if (t.lotId) {
      const lot = await getLot(t.lotId);
      if (lot) {
        let target: ShareLot = lot;
        if (t.shareCount && t.shareCount < lot.count) {
          const { split } = await splitLot(lot.id, t.shareCount);
          target = split;
        }
        await saveLot({ ...target, status: "terminating", payoutDate: t.payoutDate });
      }
    }
  }
  await put("terminations", updated);
  await logAudit(user, "Kündigung bestätigt", `Status: ${updated.status}`, t.memberId);
}

export async function rejectTermination(terminationId: string, user: AppUser, reason?: string): Promise<void> {
  const all = await listTerminations();
  const t = all.find((x) => x.id === terminationId);
  if (!t) return;
  await put("terminations", { ...t, status: "rejected" });
  await logAudit(user, "Kündigung abgelehnt", reason, t.memberId);
}

/**
 * Bricht eine Kündigung ab (ausstehend oder bereits genehmigt, solange noch nicht
 * vollzogen). Setzt Mitglied/Lot wieder auf "active" zurück.
 */
export async function cancelTermination(terminationId: string, user: AppUser, reason?: string): Promise<void> {
  const all = await listTerminations();
  const t = all.find((x) => x.id === terminationId);
  if (!t) throw new Error("Kündigung nicht gefunden");
  if (t.status === "completed") throw new Error("Bereits vollzogene Kündigung kann nicht zurückgenommen werden");
  if (t.status === "rejected" || t.status === "cancelled") throw new Error("Kündigung ist bereits beendet");

  // Effekt der Genehmigung rückgängig machen
  if (t.status === "approved") {
    const today = new Date().toISOString().slice(0, 10);
    if (t.effectiveDate <= today) {
      throw new Error("Wirksamkeitsdatum bereits erreicht – Kündigung kann nicht mehr abgebrochen werden");
    }
    if (t.target === "membership") {
      const m = await getMember(t.memberId);
      if (m && m.status === "terminating") {
        await saveMember({ ...m, status: "active", austrittDatum: undefined, kuendigungsgrund: undefined, updatedAt: new Date().toISOString() });
      }
    } else if (t.lotId) {
      const lot = await getLot(t.lotId);
      if (lot && lot.status === "terminating") {
        await saveLot({ ...lot, status: "active", payoutDate: undefined });
      }
    }
  }

  await put("terminations", { ...t, status: "cancelled" });
  await logAudit(user, "Kündigung zurückgezogen", reason, t.memberId);
}

/** Hintergrund-Job: setzt fällige terminating-Datensätze auf terminated/repaid */
export async function processDueTerminations(user: AppUser | null): Promise<{ members: number; lots: number }> {
  const today = new Date().toISOString().slice(0, 10);
  let members = 0;
  let lots = 0;
  const memberAll = await getAll<Member>("members");
  for (const m of memberAll) {
    if (m.status === "terminating" && m.austrittDatum && m.austrittDatum <= today) {
      await saveMember({ ...m, status: "terminated", updatedAt: new Date().toISOString() });
      await logAudit(user, "Mitgliedschaft beendet (automatisch)", undefined, m.id);
      members++;
    }
  }
  const lotAll = await getAll<ShareLot>("shareLots");
  for (const l of lotAll) {
    if (l.status === "terminating" && l.payoutDate && l.payoutDate <= today) {
      await saveLot({ ...l, status: "repaid" });
      await logAudit(user, "Anteilsrückzahlung fällig", `Lot ${l.id.slice(0, 6)}`, l.memberId);
      lots++;
    }
  }
  return { members, lots };
}