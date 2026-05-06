export type Role =
  | "mitglied"
  | "mitgliederverwalter"
  | "vorstand"
  | "aufsichtsrat"
  | "mitgliedsbestaetiger"
  | "zahlungspruefer"
  | "kommunikation"
  | "auszahler"
  | "admin";

export const ALL_ROLES: Role[] = [
  "mitglied",
  "mitgliederverwalter",
  "vorstand",
  "aufsichtsrat",
  "mitgliedsbestaetiger",
  "zahlungspruefer",
  "kommunikation",
  "auszahler",
  "admin",
];

export const ROLE_LABELS: Record<Role, string> = {
  mitglied: "Mitglied",
  mitgliederverwalter: "Mitgliederverwalter",
  vorstand: "Vorstand",
  aufsichtsrat: "Aufsichtsrat",
  mitgliedsbestaetiger: "Mitgliedsbestätiger",
  zahlungspruefer: "Zahlungsprüfer",
  kommunikation: "Kommunikation",
  auszahler: "Auszahler",
  admin: "Admin",
};

export interface AppUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  /** Optional verknüpftes Mitglied (für Rolle "mitglied") */
  memberId?: string;
}

export type Kontakttyp = "Privatperson" | "Unternehmen";
export type Anrede = "Frau" | "Herr" | "Divers" | "Keine";
export type Land = "DE" | "AT" | "CH";

export type Konfession = "keine" | "rk" | "ev" | "sonstige";
export const KONFESSION_LABELS: Record<Konfession, string> = {
  keine: "Keine",
  rk: "Römisch-katholisch",
  ev: "Evangelisch",
  sonstige: "Sonstige (keine KiSt)",
};

export type Bundesland =
  | "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV"
  | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";
export const BUNDESLAND_LABELS: Record<Bundesland, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
};

export type MemberStatus = "pending" | "active" | "terminating" | "terminated" | "rejected";

export interface Member {
  id: string;
  mitgliedsnummer: number;
  status: MemberStatus;
  typ: Kontakttyp;
  anrede: Anrede;
  titel?: string;
  bevorzugteAnrede?: string;
  vorname: string;
  nachname: string;
  firma?: string;
  geburtsdatum?: string;
  email: string;
  telefon?: string;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  land: Land;
  iban?: string;
  bic?: string;
  kontoinhaber?: string;
  newsletter: boolean;
  /** Datum, ab dem die Mitgliedschaft aktiv ist (Beitrittsdatum) */
  beitrittDatum?: string;
  /** Bei Status "terminating" / "terminated" gesetzt */
  austrittDatum?: string;
  kuendigungsgrund?: string;
  /** Steuerliche Angaben (Kapitalertragsteuer) */
  freistellung?: boolean;
  konfession?: Konfession;
  bundesland?: Bundesland;
  steuerId?: string;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type LotStatus =
  | "pending_payment"
  | "active"
  | "terminating"
  | "transferred"
  | "repaid";

export interface ShareLot {
  id: string;
  memberId: string;
  count: number;
  valuePerShare: number;
  signedAt: string;
  paidAt?: string;
  status: LotStatus;
  /** Bei terminating: berechnetes Auszahlungsdatum */
  payoutDate?: string;
  /** Bei transferred: Ziel-Lot-ID */
  transferredToLotId?: string;
  /** Stammt aus Übertragung */
  sourceLotId?: string;
}

export interface Approval {
  id: string;
  memberId: string;
  userId: string;
  userName: string;
  role: Role;
  decision: "approve" | "reject";
  reason?: string;
  at: string;
}

export interface PaymentConfirmation {
  id: string;
  memberId: string;
  lotId: string;
  userId: string;
  userName: string;
  amount: number;
  at: string;
}

export type TerminationTarget = "membership" | "share";
export type TerminationStatus = "pending" | "approved" | "rejected" | "completed" | "cancelled";

export interface Termination {
  id: string;
  target: TerminationTarget;
  memberId: string;
  /** Nur bei target="share" */
  lotId?: string;
  /** Anteilanzahl bei share-Kündigung (Teilkündigung möglich) */
  shareCount?: number;
  requestedBy: string;
  requestedAt: string;
  reason?: string;
  /** Berechneter frühester Austrittstermin */
  effectiveDate: string;
  /** Auszahlungsdatum (kann nach effectiveDate liegen) */
  payoutDate: string;
  status: TerminationStatus;
  approvals: { userId: string; userName: string; role: Role; at: string }[];
}

export type TransferKind = "sale" | "donation";
export type TransferStatus = "pending" | "approved" | "rejected";

export interface ShareTransfer {
  id: string;
  kind: TransferKind;
  fromMemberId: string;
  fromLotId: string;
  toMemberId: string;
  count: number;
  pricePerShare: number;
  note?: string;
  status: TransferStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export type DocVisibility = "public" | "members" | "internal";
export type DocCategory =
  | "Satzung"
  | "Geschäftsbericht"
  | "Protokoll"
  | "Sonstiges"
  | "Beitrittsantrag"
  | "Ausweiskopie"
  | "SEPA-Mandat"
  | "Kündigung"
  | "Steuerbescheinigung";

export interface DocumentRecord {
  id: string;
  /** undefined = globales Dokument */
  memberId?: string;
  title: string;
  description?: string;
  category: DocCategory;
  visibility: DocVisibility;
  /** Slug nur für globale public-Dokumente */
  slug?: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  /** Pro Mitglieds-Doc: auch für Mitglied selbst sichtbar */
  visibleToMember?: boolean;
}

export interface DocumentFile {
  id: string; // = DocumentRecord.id
  blob: Blob;
}

export type CampaignType = "newsletter" | "termin" | "mitteilung";
export interface Campaign {
  id: string;
  type: CampaignType;
  subject: string;
  bodyHtml: string;
  /** Termin-spezifisch */
  startsAt?: string;
  endsAt?: string;
  location?: string;
  /** Empfängerfilter */
  audience: {
    newsletterOnly: boolean;
    statuses: MemberStatus[];
    /** Wenn gesetzt, werden ausschließlich diese Mitgliedsnummern adressiert (Custom-Auswahl) */
    memberIds?: string[];
  };
  createdAt: string;
  createdBy: string;
}

export interface DividendItem {
  memberId: string;
  lotId: string;
  days: number;
  /** Brutto-Betrag (vor Steuer) – identisch mit altem `amount` */
  amount: number;
  /** Brutto = amount, redundant für Klarheit */
  gross?: number;
  kapest?: number;
  soli?: number;
  kist?: number;
  /** Auszahlungsbetrag nach Steuern */
  net?: number;
  freigestellt?: boolean;
  /** KiSt-Satz in %: 0, 8 oder 9 */
  kistRate?: number;
}
export interface DividendRun {
  id: string;
  fiscalYear: number;
  ratePercent: number;
  createdAt: string;
  createdBy: string;
  items: DividendItem[];
  totalAmount: number;
  /** Aggregierte Steuer-Summen über den Lauf */
  totals?: {
    gross: number;
    kapest: number;
    soli: number;
    kist: number;
    net: number;
  };
  /** Map: memberId -> documentId der erzeugten Steuerbescheinigung */
  certificates?: Record<string, string>;
}

export interface AuditEntry {
  id: string;
  memberId?: string;
  userId: string;
  userName: string;
  action: string;
  details?: string;
  at: string;
}

export type CustomFieldType = "text" | "number" | "date" | "checkbox" | "select";
export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  showOnSignup: boolean;
  options?: string[];
}

export type StichtagKind = "monthEnd" | "quarterEnd" | "halfYearEnd" | "yearEnd" | "free";
export type AuszahlungsRegel = "immediate" | "afterFiscalYear";

export interface KuendigungsKonfig {
  fristAnzahl: number;
  fristEinheit: "month" | "year";
  stichtag: StichtagKind;
  mindestHaltedauerMonate: number;
  bestaetigerRollen: Role[];
  anzahlBestaetigungen: number;
  auszahlung: AuszahlungsRegel;
}

export interface BeitrittsKonfig {
  anzahlBestaetigungen: number;
  zahlungPflicht: boolean;
  zahlungspruefer: Role[];
  aufsichtsratPflicht: boolean;
  aufsichtsratAnzahl: number;
  verhindereDoppelapproval: boolean;
  verhindereSelfApproval: boolean;
}

export interface TransferKonfig {
  verkaufErlaubt: boolean;
  spendeErlaubt: boolean;
  bestaetigerRollen: Role[];
}

export interface WorkflowConfig {
  beitritt: BeitrittsKonfig;
  membership: KuendigungsKonfig;
  share: KuendigungsKonfig;
  transfer: TransferKonfig;
}

export interface Settings {
  genossenschaftsName: string;
  /** Logo als data-URL */
  logoDataUrl?: string;
  primary: string;
  accent: string;
  background?: string;
  sidebarBackground?: string;
  foreground?: string;
  sidebarForeground?: string;
  anteilsWert: number;
  minAnteile: number;
  maxAnteile: number;
  bank: {
    kontoinhaber: string;
    iban: string;
    bic: string;
    glaeubigerId?: string;
    land: Land;
  };
  laenderReihenfolge: Land[];
  defaultLand: Land;
  fiscalYearEndMonth: number; // 12 = Dezember
  signup?: SignupBranding;
  newsletter?: NewsletterBranding;
  /** Stammdaten der Genossenschaft (für Bescheinigungen, Impressum, etc.) */
  genossenschaft?: GenossenschaftStammdaten;
}

export interface GenossenschaftStammdaten {
  name?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  land?: Land;
  steuernummer?: string;
  ustIdNr?: string;
  vertretenDurch?: string;
  registergericht?: string;
  registernummer?: string;
}

export interface SignupBranding {
  /** Einleitungstext oberhalb des Formulars (Markdown-light: Zeilenumbrüche bleiben erhalten) */
  intro?: string;
  /** Logo im öffentlichen Anmeldeformular anzeigen */
  showLogo: boolean;
  /** Layout: 'stepper' = mehrstufig, 'single' = ein langes Formular */
  layout: "stepper" | "single";
  /** Eigenes CSS, wird nur auf der öffentlichen Anmelde-Seite injiziert */
  customCss?: string;
  /** Titel der öffentlichen Anmeldeseite */
  title?: string;
  /** Text für die Satzungs-Akzeptanz-Checkbox (HTML erlaubt: z.B. Link auf Satzung) */
  satzungText?: string;
  /** Newsletter-Opt-In auf dem Formular anzeigen */
  showNewsletter: boolean;
}

export interface NewsletterBranding {
  /** HTML-Snippet, das oberhalb des Inhalts gerendert wird (z. B. Logo + Titel) */
  headerHtml?: string;
  /** HTML-Snippet, das unterhalb des Inhalts gerendert wird (z. B. Adresse, Abmelde-Link) */
  footerHtml?: string;
  /** Hintergrundfarbe der Mail (außerhalb des Inhaltsbereichs) */
  background?: string;
  /** Hintergrundfarbe des Inhaltsbereichs */
  contentBackground?: string;
  /** Textfarbe im Inhaltsbereich */
  textColor?: string;
  /** Akzentfarbe (Links / Buttons) */
  accentColor?: string;
}