import type { KuendigungsKonfig, StichtagKind } from "./types";

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function nextStichtag(from: Date, kind: StichtagKind): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  if (kind === "monthEnd") return endOfMonth(from);
  if (kind === "yearEnd") return new Date(y, 11, 31);
  if (kind === "quarterEnd") {
    const qEndMonth = m - (m % 3) + 2; // 2,5,8,11
    let candidate = new Date(y, qEndMonth + 1, 0);
    if (candidate < from) candidate = new Date(y, qEndMonth + 4, 0);
    return candidate;
  }
  if (kind === "halfYearEnd") {
    let candidate = m < 6 ? new Date(y, 5, 30) : new Date(y, 11, 31);
    if (candidate < from) candidate = new Date(y + 1, 5, 30);
    return candidate;
  }
  // free → exakt das Datum
  return from;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

/**
 * Berechnet den frühestmöglichen Austrittstermin gemäß Konfiguration.
 * - cfg: Kündigungs-Konfig
 * - signedAt: Beitritts-/Zeichnungsdatum (für Mindesthaltedauer)
 * - requestedAt: Eingangsdatum der Kündigung (Default heute)
 */
export function calcEffectiveDate(
  cfg: KuendigungsKonfig,
  signedAt: string,
  requestedAt: string = new Date().toISOString(),
): Date {
  const months = cfg.fristEinheit === "year" ? cfg.fristAnzahl * 12 : cfg.fristAnzahl;
  const after = addMonths(new Date(requestedAt), months);
  const stichtag = nextStichtag(after, cfg.stichtag);
  const minEnd = addMonths(new Date(signedAt), cfg.mindestHaltedauerMonate);
  return stichtag > minEnd ? stichtag : nextStichtag(minEnd, cfg.stichtag);
}

export function calcPayoutDate(cfg: KuendigungsKonfig, effective: Date, fiscalYearEndMonth: number): Date {
  if (cfg.auszahlung === "immediate") return effective;
  // afterFiscalYear: nach Bilanzfeststellung des Folgejahres → 6 Monate nach Geschäftsjahresende des Folgejahres
  const y = effective.getFullYear();
  const fyEnd = new Date(y, fiscalYearEndMonth - 1 + 1, 0); // Monatsende von fiscalYearEndMonth
  const target = effective <= fyEnd ? fyEnd : new Date(y + 1, fiscalYearEndMonth - 1 + 1, 0);
  // Bilanzfeststellung typischerweise ~6 Monate nach Geschäftsjahresende
  return addMonths(target, 6);
}