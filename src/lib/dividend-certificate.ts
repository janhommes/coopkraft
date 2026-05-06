import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { GenossenschaftStammdaten, Member, ShareLot } from "./types";
import { BUNDESLAND_LABELS, KONFESSION_LABELS } from "./types";
import { formatDate, formatEuro } from "./locale";
import { computeTax, kistRateFor } from "./tax";

export interface CertificateLotLine {
  lot: ShareLot;
  days: number;
  gross: number;
}

export interface CertificateInput {
  member: Member;
  fiscalYear: number;
  ratePercent: number;
  lots: CertificateLotLine[];
  aussteller?: GenossenschaftStammdaten;
  ausstellerName: string;
  logoDataUrl?: string;
}

export function buildCertificatePdf(input: CertificateInput): Blob {
  const { member, fiscalYear, ratePercent, lots, aussteller, ausstellerName, logoDataUrl } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // Logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", pageWidth - margin - 30, y, 30, 18, undefined, "FAST");
    } catch {
      // ignore broken logo
    }
  }

  // Aussteller-Block
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(aussteller?.name || ausstellerName || "Genossenschaft", margin, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const ausstellerLines: string[] = [];
  if (aussteller?.strasse || aussteller?.hausnummer) {
    ausstellerLines.push(`${aussteller?.strasse ?? ""} ${aussteller?.hausnummer ?? ""}`.trim());
  }
  if (aussteller?.plz || aussteller?.ort) {
    ausstellerLines.push(`${aussteller?.plz ?? ""} ${aussteller?.ort ?? ""}`.trim());
  }
  if (aussteller?.steuernummer) ausstellerLines.push(`Steuernummer: ${aussteller.steuernummer}`);
  if (aussteller?.ustIdNr) ausstellerLines.push(`USt-IdNr.: ${aussteller.ustIdNr}`);
  if (aussteller?.vertretenDurch) ausstellerLines.push(`Vertreten durch: ${aussteller.vertretenDurch}`);
  let blockY = y + 9;
  for (const line of ausstellerLines) {
    doc.text(line, margin, blockY);
    blockY += 4;
  }
  y = Math.max(blockY, y + 24) + 6;

  // Empfänger-Block
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Empfänger:", margin, y);
  doc.setFont("helvetica", "bold").setFontSize(10);
  const empName = `${member.vorname} ${member.nachname}`.trim();
  doc.text(empName, margin, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const empLines = [
    `${member.strasse ?? ""} ${member.hausnummer ?? ""}`.trim(),
    `${member.plz ?? ""} ${member.ort ?? ""}`.trim(),
    `Mitgliedsnummer: ${member.mitgliedsnummer}`,
  ];
  if (member.steuerId) empLines.push(`Steuer-ID: ${member.steuerId}`);
  let ey = y + 10;
  for (const line of empLines) {
    if (line.trim()) {
      doc.text(line, margin, ey);
      ey += 4;
    }
  }
  y = ey + 6;

  // Titel
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(`Steuerbescheinigung Dividende Geschäftsjahr ${fiscalYear}`, margin, y);
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(
    `Dividendensatz: ${ratePercent} % auf das eingezahlte Geschäftsguthaben.`,
    margin,
    y,
  );
  y += 6;

  // Lot-Tabelle
  const yearStart = `${fiscalYear}-01-01`;
  const yearEnd = `${fiscalYear}-12-31`;
  const lotRows = lots.map((l) => [
    formatDate(l.lot.signedAt),
    String(l.lot.count),
    formatEuro(l.lot.valuePerShare),
    String(l.days),
    formatEuro(l.gross),
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Gezeichnet am", "Anteile", "Wert/Anteil", "Tage im GJ", "Brutto-Dividende"]],
    body: lotRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [70, 70, 70] },
    foot: [[
      `Zeitraum: ${formatDate(yearStart)} – ${formatDate(yearEnd)}`,
      "",
      "",
      "Summe Brutto:",
      formatEuro(lots.reduce((s, l) => s + l.gross, 0)),
    ]],
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
  });
  // @ts-expect-error - lastAutoTable existiert auf doc
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // Steuer-Tabelle
  const grossSum = lots.reduce((s, l) => s + l.gross, 0);
  const tax = computeTax({
    gross: grossSum,
    freistellung: !!member.freistellung,
    konfession: member.konfession ?? "keine",
    bundesland: member.bundesland,
  });
  const kistRate = kistRateFor(member.konfession ?? "keine", member.bundesland);

  const taxRows: string[][] = [
    ["Brutto-Dividende", formatEuro(tax.gross)],
  ];
  if (tax.freigestellt) {
    taxRows.push(["Freistellungsauftrag", "Ja – kein Steuerabzug"]);
  } else {
    taxRows.push(["Kapitalertragsteuer (25 %)", `– ${formatEuro(tax.kapest)}`]);
    taxRows.push(["Solidaritätszuschlag (5,5 % auf KapESt)", `– ${formatEuro(tax.soli)}`]);
    taxRows.push([
      kistRate > 0
        ? `Kirchensteuer (${kistRate} % auf KapESt, ${KONFESSION_LABELS[member.konfession ?? "keine"]}, ${BUNDESLAND_LABELS[member.bundesland ?? "NW"]})`
        : "Kirchensteuer",
      kistRate > 0 ? `– ${formatEuro(tax.kist)}` : formatEuro(0),
    ]);
  }
  taxRows.push(["Auszahlungsbetrag (Netto)", formatEuro(tax.net)]);
  autoTable(doc, {
    startY: y,
    head: [["Position", "Betrag"]],
    body: taxRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [70, 70, 70] },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === taxRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });
  // @ts-expect-error - lastAutoTable existiert auf doc
  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  // Fußhinweis
  doc.setFont("helvetica", "normal").setFontSize(8);
  const today = new Date();
  doc.text(
    [
      `Ausgestellt am ${formatDate(today.toISOString())}${aussteller?.ort ? ` in ${aussteller.ort}` : ""}.`,
      "Diese Bescheinigung wurde elektronisch erzeugt und ist auch ohne Unterschrift gültig.",
      tax.freigestellt
        ? "Hinweis: Aufgrund eines vorliegenden Freistellungsauftrags wurde keine Steuer einbehalten."
        : "Hinweis: Eine etwaige Minderung der Kapitalertragsteuer durch den Sonderausgaben­abzug der Kirchensteuer (§ 32d Abs. 1 EStG) ist nicht berücksichtigt.",
    ].join("\n"),
    margin,
    y,
    { maxWidth: pageWidth - 2 * margin },
  );

  return doc.output("blob");
}