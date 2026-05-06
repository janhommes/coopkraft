import type { Settings, Member } from "@/lib/types";

/** IBAN mod-97 Validierung */
export function isValidIban(iban: string): boolean {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => (c.charCodeAt(0) - 55).toString());
  // mod 97 in Stücken
  let rem = "";
  for (const ch of expanded) {
    rem = (rem + ch).slice(-9);
    rem = String(parseInt(rem, 10) % 97);
  }
  return parseInt(rem, 10) === 1;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

export interface SepaPayment {
  member: Member;
  amount: number;
  purpose: string;
}

/**
 * Erzeugt SEPA Sammelüberweisung pain.001.001.09 als XML-String.
 */
export function generateSepaXml(settings: Settings, payments: SepaPayment[], executionDate: string): string {
  const msgId = `MSG-${Date.now()}`;
  const pmtInfId = `PMT-${Date.now()}`;
  const total = payments.reduce((s, p) => s + p.amount, 0).toFixed(2);
  const created = new Date().toISOString();
  const txns = payments
    .map((p, i) => {
      const id = `E2E-${Date.now()}-${i}`;
      const iban = (p.member.iban ?? "").replace(/\s+/g, "");
      const bic = p.member.bic?.replace(/\s+/g, "");
      const name = `${p.member.vorname} ${p.member.nachname}`.trim() || p.member.firma || "Empfänger";
      return `
    <CdtTrfTxInf>
      <PmtId><EndToEndId>${escapeXml(id)}</EndToEndId></PmtId>
      <Amt><InstdAmt Ccy="EUR">${p.amount.toFixed(2)}</InstdAmt></Amt>
      ${bic ? `<CdtrAgt><FinInstnId><BICFI>${escapeXml(bic)}</BICFI></FinInstnId></CdtrAgt>` : ""}
      <Cdtr><Nm>${escapeXml(name)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${escapeXml(iban)}</IBAN></Id></CdtrAcct>
      <RmtInf><Ustrd>${escapeXml(p.purpose)}</Ustrd></RmtInf>
    </CdtTrfTxInf>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(msgId)}</MsgId>
      <CreDtTm>${created}</CreDtTm>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <InitgPty><Nm>${escapeXml(settings.bank.kontoinhaber || settings.genossenschaftsName)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(pmtInfId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${total}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt><Dt>${executionDate}</Dt></ReqdExctnDt>
      <Dbtr><Nm>${escapeXml(settings.bank.kontoinhaber)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${escapeXml(settings.bank.iban.replace(/\s+/g, ""))}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>${escapeXml(settings.bank.bic)}</BICFI></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      ${txns}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}