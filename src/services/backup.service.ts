import { getDb, DB_VERSION, type AppSchema } from "./db";

export const STORE_NAMES: (keyof AppSchema)[] = [
  "users", "members", "shareLots", "shareTransfers", "terminations", "approvals",
  "paymentConfirmations", "documents", "documentFiles", "campaigns", "dividends",
  "settings", "customFields", "workflowConfig", "auditLog", "meta",
];

export const STORE_LABELS: Record<keyof AppSchema, string> = {
  users: "Testpersonen", members: "Mitglieder", shareLots: "Anteile", shareTransfers: "Übertragungen",
  terminations: "Kündigungen", approvals: "Freigaben", paymentConfirmations: "Zahlungsprüfungen",
  documents: "Dokumente", documentFiles: "Dateien", campaigns: "Kampagnen", dividends: "Dividendenläufe",
  settings: "Einstellungen", customFields: "Benutzerdefinierte Felder", workflowConfig: "Workflows",
  auditLog: "Protokoll", meta: "Systemdaten",
};

export interface BackupFile {
  format: "egv-backup";
  version: number;
  createdAt: string;
  tables: Record<string, unknown[]>;
}

export async function getTableCounts(): Promise<{ name: keyof AppSchema; count: number }[]> {
  const db = await getDb();
  return Promise.all(STORE_NAMES.map(async (name) => ({ name, count: await db.count(name) })));
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDb();
  const tables: Record<string, unknown[]> = {};
  for (const name of STORE_NAMES) {
    const rows = (await db.getAll(name)) as Record<string, unknown>[];
    tables[name] = name === "documentFiles"
      ? await Promise.all(rows.map(async (r) => ({ id: r.id, dataUrl: await blobToDataUrl(r.blob as Blob) })))
      : rows;
  }
  return { format: "egv-backup", version: DB_VERSION, createdAt: new Date().toISOString(), tables };
}

/** Ersetzt ALLE Daten durch den Inhalt der Sicherung. */
export async function restoreBackup(file: BackupFile): Promise<void> {
  if (file?.format !== "egv-backup" || typeof file.tables !== "object") throw new Error("Keine gültige Sicherungsdatei");
  const db = await getDb();
  const prepared: Record<string, unknown[]> = {};
  for (const name of STORE_NAMES) {
    const rows = (file.tables[name] ?? []) as Record<string, unknown>[];
    prepared[name] = name === "documentFiles"
      ? await Promise.all(rows.map(async (r) => ({ id: r.id, blob: await (await fetch(r.dataUrl as string)).blob() })))
      : rows;
  }
  const tx = db.transaction(STORE_NAMES as string[], "readwrite");
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name);
    await store.clear();
    for (const row of prepared[name]) await store.put(row as never);
  }
  await tx.done;
}
