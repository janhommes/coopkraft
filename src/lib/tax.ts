import type { Bundesland, Konfession, Member } from "./types";

export interface TaxInput {
  gross: number;
  freistellung: boolean;
  konfession: Konfession;
  bundesland?: Bundesland;
}

export interface TaxResult {
  gross: number;
  kapest: number;
  soli: number;
  kist: number;
  net: number;
  kistRate: number;
  freigestellt: boolean;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function kistRateFor(konfession: Konfession, bundesland?: Bundesland): number {
  if (konfession !== "rk" && konfession !== "ev") return 0;
  if (bundesland === "BY" || bundesland === "BW") return 8;
  return 9;
}

export function computeTax(input: TaxInput): TaxResult {
  const gross = r2(input.gross);
  if (input.freistellung || gross <= 0) {
    return { gross, kapest: 0, soli: 0, kist: 0, net: gross, kistRate: 0, freigestellt: true };
  }
  const kapest = r2(gross * 0.25);
  const soli = r2(kapest * 0.055);
  const kistRate = kistRateFor(input.konfession, input.bundesland);
  const kist = kistRate > 0 ? r2(kapest * (kistRate / 100)) : 0;
  const net = r2(gross - kapest - soli - kist);
  return { gross, kapest, soli, kist, net, kistRate, freigestellt: false };
}

export function taxFromMember(member: Member, gross: number): TaxResult {
  return computeTax({
    gross,
    freistellung: !!member.freistellung,
    konfession: member.konfession ?? "keine",
    bundesland: member.bundesland,
  });
}