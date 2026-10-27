import type {
  AppUser,
  Approval,
  AuditEntry,
  Campaign,
  CustomFieldDef,
  DividendRun,
  DocumentFile,
  DocumentRecord,
  Member,
  PaymentConfirmation,
  Settings,
  ShareLot,
  ShareTransfer,
  Termination,
  WorkflowConfig,
} from "@/lib/types";

/**
 * Datenbereiche der App. Gleiche Namen in IndexedDB, Sicherungsdatei und REST-API
 * (`/api/data/<store>`). Neuer Bereich: hier ergänzen + Tabelle in docs/schema.sql
 * (+ backend/src/Tables.php, siehe AGENTS.md). `node scripts/check-contract.mjs` prüft das.
 */
export const STORE_NAMES = [
  "users",
  "members",
  "shareLots",
  "shareTransfers",
  "terminations",
  "approvals",
  "paymentConfirmations",
  "documents",
  "documentFiles",
  "campaigns",
  "dividends",
  "settings",
  "customFields",
  "workflowConfig",
  "auditLog",
  "meta",
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

export interface AppSchema {
  users: AppUser;
  members: Member;
  shareLots: ShareLot;
  shareTransfers: ShareTransfer;
  terminations: Termination;
  approvals: Approval;
  paymentConfirmations: PaymentConfirmation;
  documents: DocumentRecord;
  documentFiles: DocumentFile;
  campaigns: Campaign;
  dividends: DividendRun;
  settings: { id: "singleton"; data: Settings };
  customFields: CustomFieldDef;
  workflowConfig: { id: "singleton"; data: WorkflowConfig };
  auditLog: AuditEntry;
  meta: { id: string; value: unknown };
}

/** Version des Sicherungsformats (und der IndexedDB). */
export const DB_VERSION = 1;

/** Zeilen im Sicherungsformat: wie gespeichert, nur documentFiles als `{ id, dataUrl }`. */
export type BackupTables = Record<string, unknown[]>;
