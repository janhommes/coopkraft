import {
  countAll,
  exportTables,
  importTables,
  DB_VERSION,
  STORE_NAMES,
  type AppSchema,
} from "./db";

export { STORE_NAMES };

export const STORE_LABELS: Record<keyof AppSchema, string> = {
  users: "Testpersonen",
  members: "Mitglieder",
  shareLots: "Anteile",
  shareTransfers: "Übertragungen",
  terminations: "Kündigungen",
  approvals: "Freigaben",
  paymentConfirmations: "Zahlungsprüfungen",
  documents: "Dokumente",
  documentFiles: "Dateien",
  campaigns: "Kampagnen",
  dividends: "Dividendenläufe",
  settings: "Einstellungen",
  customFields: "Benutzerdefinierte Felder",
  workflowConfig: "Workflows",
  auditLog: "Protokoll",
  meta: "Systemdaten",
};

export interface BackupFile {
  format: "egv-backup";
  version: number;
  createdAt: string;
  tables: Record<string, unknown[]>;
}

export async function getTableCounts(): Promise<{ name: keyof AppSchema; count: number }[]> {
  const counts = await countAll();
  return STORE_NAMES.map((name) => ({ name, count: counts[name] ?? 0 }));
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    format: "egv-backup",
    version: DB_VERSION,
    createdAt: new Date().toISOString(),
    tables: await exportTables(),
  };
}

/** Ersetzt ALLE Daten durch den Inhalt der Sicherung. */
export async function restoreBackup(file: BackupFile): Promise<void> {
  if (file?.format !== "egv-backup" || typeof file.tables !== "object")
    throw new Error("Keine gültige Sicherungsdatei");
  await importTables(file.tables);
}
