import { getAll, getOne, put, uid } from "./db";
import type {
  AppUser,
  CustomFieldDef,
  DocumentRecord,
  Member,
  Settings,
  ShareLot,
  WorkflowConfig,
} from "@/lib/types";

const SEED_FLAG = "seeded-v1";

const defaultSettings: Settings = {
  genossenschaftsName: "Demo Energie eG",
  primary: "#2e7d32",
  accent: "#f5a524",
  background: "#ffffff",
  sidebarBackground: "#f7f7f5",
  foreground: "#0a0a0a",
  sidebarForeground: "#0a0a0a",
  anteilsWert: 100,
  minAnteile: 1,
  maxAnteile: 100,
  bank: {
    kontoinhaber: "Demo Energie eG",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    glaeubigerId: "DE98ZZZ09999999999",
    land: "DE",
  },
  laenderReihenfolge: ["DE", "AT", "CH"],
  defaultLand: "DE",
  fiscalYearEndMonth: 12,
  signup: {
    intro:
      "Werde Teil unserer Energiegenossenschaft und gestalte die Energiewende vor Ort mit.\n\nDie Mitgliedschaft wird nach Eingang der erforderlichen Bestätigungen und deines Anteilsbeitrags aktiv.",
    showLogo: true,
    layout: "stepper",
    customCss: "",
    title: "Mitglied werden",
    satzungText: 'Ich habe die <a href="/dokumente/satzung" target="_blank" rel="noreferrer" class="underline">Satzung</a> gelesen und akzeptiere sie.',
    showNewsletter: true,
  },
};

const defaultWorkflow: WorkflowConfig = {
  beitritt: {
    anzahlBestaetigungen: 3,
    zahlungPflicht: true,
    zahlungspruefer: ["zahlungspruefer"],
    aufsichtsratPflicht: false,
    aufsichtsratAnzahl: 1,
    verhindereDoppelapproval: true,
    verhindereSelfApproval: true,
  },
  membership: {
    fristAnzahl: 3,
    fristEinheit: "month",
    stichtag: "yearEnd",
    mindestHaltedauerMonate: 24,
    bestaetigerRollen: ["mitgliederverwalter", "vorstand"],
    anzahlBestaetigungen: 1,
    auszahlung: "afterFiscalYear",
  },
  share: {
    fristAnzahl: 3,
    fristEinheit: "month",
    stichtag: "quarterEnd",
    mindestHaltedauerMonate: 0,
    bestaetigerRollen: ["mitgliederverwalter", "vorstand"],
    anzahlBestaetigungen: 1,
    auszahlung: "immediate",
  },
  transfer: {
    verkaufErlaubt: true,
    spendeErlaubt: true,
    bestaetigerRollen: ["mitgliederverwalter", "vorstand"],
  },
};

const demoUsers: AppUser[] = [
  { id: "u-anna", name: "Anna Mitglied", email: "anna@demo.de", roles: ["mitglied"] },
  { id: "u-bernd", name: "Bernd Vorstand", email: "bernd@demo.de", roles: ["vorstand", "mitgliedsbestaetiger", "auszahler"] },
  { id: "u-clara", name: "Clara Vorstand", email: "clara@demo.de", roles: ["vorstand", "mitgliedsbestaetiger"] },
  { id: "u-dieter", name: "Dieter Vorstand", email: "dieter@demo.de", roles: ["vorstand", "mitgliedsbestaetiger", "kommunikation"] },
  { id: "u-eva", name: "Eva Aufsichtsrat", email: "eva@demo.de", roles: ["aufsichtsrat"] },
  { id: "u-frank", name: "Frank Buchhalter", email: "frank@demo.de", roles: ["zahlungspruefer", "auszahler"] },
  { id: "u-gabi", name: "Gabi Mitgliederverwalter", email: "gabi@demo.de", roles: ["mitgliederverwalter"] },
  { id: "u-greta", name: "Greta Admin", email: "greta@demo.de", roles: ["admin", "vorstand"] },
];

const VORNAMEN = ["Lisa", "Tom", "Sven", "Mara", "Jonas", "Helena", "Paul", "Mia", "Felix", "Nora", "Karl", "Sara", "Lukas", "Julia", "Erik", "Tina", "Otto", "Lena", "Max", "Eva", "Jens", "Petra", "Hans", "Ute"];
const NACHNAMEN = ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Hoffmann", "Schulz", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt"];
const ORTE = ["Berlin", "Hamburg", "München", "Köln", "Leipzig", "Dresden", "Bremen", "Hannover", "Stuttgart", "Frankfurt"];

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeMember(i: number, status: Member["status"]): Member {
  const vorname = VORNAMEN[i % VORNAMEN.length];
  const nachname = NACHNAMEN[(i * 3) % NACHNAMEN.length];
  const ort = rnd(ORTE);
  const beitritt = new Date(2020 + (i % 5), i % 12, ((i * 7) % 27) + 1).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return {
    id: `m-seed-${i}`,
    mitgliedsnummer: 1000 + i,
    status,
    typ: "Privatperson",
    anrede: i % 2 === 0 ? "Frau" : "Herr",
    vorname,
    nachname,
    email: `${vorname.toLowerCase()}.${nachname.toLowerCase()}@example.de`,
    telefon: `+49 30 ${1000000 + i * 137}`,
    strasse: "Hauptstraße",
    hausnummer: String((i % 80) + 1),
    plz: String(10000 + (i * 137) % 89999),
    ort,
    land: "DE",
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    kontoinhaber: `${vorname} ${nachname}`,
    newsletter: i % 3 !== 0,
    beitrittDatum: status === "active" || status === "terminating" ? beitritt : undefined,
    austrittDatum: status === "terminating" ? new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10) : undefined,
    customFields: {},
    createdAt: now,
    updatedAt: now,
  };
}

export async function seedIfEmpty(): Promise<void> {
  const meta = await getOne<{ id: string; value: unknown }>("meta", SEED_FLAG);
  if (meta) return;

  await put("settings", { id: "singleton", data: defaultSettings });
  await put("workflowConfig", { id: "singleton", data: defaultWorkflow });
  for (const u of demoUsers) await put("users", u);

  const cf: CustomFieldDef = {
    id: uid(),
    key: "wieGehoert",
    label: "Wie hast du von uns erfahren?",
    type: "select",
    required: false,
    showOnSignup: true,
    options: ["Empfehlung", "Internet", "Presse", "Sonstiges"],
  };
  await put("customFields", cf);

  // Mitglieder
  const statuses: Member["status"][] = [
    ...Array(15).fill("active"),
    ...Array(6).fill("pending"),
    ...Array(2).fill("terminating"),
    ...Array(2).fill("rejected"),
  ] as Member["status"][];

  // Erstes aktives Mitglied = Anna verknüpfen
  for (let i = 0; i < statuses.length; i++) {
    const m = makeMember(i, statuses[i]);
    if (i === 0) {
      m.id = "m-anna";
      m.vorname = "Anna";
      m.nachname = "Mitglied";
      m.email = "anna@demo.de";
    }
    await put("members", m);
  }
  // Anna mit User verknüpfen
  const anna = await getOne<AppUser>("users", "u-anna");
  if (anna) await put("users", { ...anna, memberId: "m-anna" });

  // Lots
  const allMembers = (await getAll<Member>("members")).filter((m) => m.status !== "rejected");
  for (const m of allMembers) {
    const numLots = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLots; i++) {
      const count = 1 + Math.floor(Math.random() * 5);
      const lot: ShareLot = {
        id: uid(),
        memberId: m.id,
        count,
        valuePerShare: defaultSettings.anteilsWert,
        signedAt: m.beitrittDatum ?? new Date().toISOString().slice(0, 10),
        paidAt: m.status === "pending" && i === 0 ? undefined : new Date().toISOString().slice(0, 10),
        status: m.status === "pending" && i === 0 ? "pending_payment" : "active",
      };
      await put("shareLots", lot);
    }
  }

  // Globale Dokumente (Platzhalter-PDFs als Blob)
  const placeholder = new Blob(["Platzhalter-Inhalt"], { type: "application/pdf" });
  const docs: Omit<DocumentRecord, "id">[] = [
    { title: "Satzung", description: "Satzung der Genossenschaft", category: "Satzung", visibility: "public", slug: "satzung", fileName: "satzung.pdf", mimeType: "application/pdf", size: placeholder.size, uploadedAt: new Date().toISOString(), uploadedBy: "Greta Admin" },
    { title: "Geschäftsbericht 2024", description: "", category: "Geschäftsbericht", visibility: "members", fileName: "gb-2024.pdf", mimeType: "application/pdf", size: placeholder.size, uploadedAt: new Date().toISOString(), uploadedBy: "Greta Admin" },
    { title: "Vorstandsprotokoll Q1", description: "", category: "Protokoll", visibility: "internal", fileName: "protokoll.pdf", mimeType: "application/pdf", size: placeholder.size, uploadedAt: new Date().toISOString(), uploadedBy: "Greta Admin" },
  ];
  for (const d of docs) {
    const id = uid();
    await put("documents", { ...d, id });
    await put("documentFiles", { id, blob: placeholder });
  }

  await put("meta", { id: SEED_FLAG, value: new Date().toISOString() });
}

export async function resetDatabase(): Promise<void> {
  // Lösche flag damit reseed möglich
  const stores = ["users", "members", "shareLots", "shareTransfers", "terminations", "approvals", "paymentConfirmations", "documents", "documentFiles", "campaigns", "dividends", "settings", "customFields", "workflowConfig", "auditLog", "meta"] as const;
  const { getDb } = await import("./db");
  const db = await getDb();
  for (const s of stores) {
    const tx = db.transaction(s, "readwrite");
    await tx.objectStore(s).clear();
    await tx.done;
  }
  await seedIfEmpty();
}