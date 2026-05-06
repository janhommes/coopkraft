import { openDB, type IDBPDatabase } from "idb";
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

export const DB_NAME = "energiegenossenschaft";
export const DB_VERSION = 1;

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

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

export function getDb(): Promise<IDBPDatabase<unknown>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB nicht verfügbar"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const stores: (keyof AppSchema)[] = [
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
        ];
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll<T>(store: keyof AppSchema): Promise<T[]> {
  const db = await getDb();
  return (await db.getAll(store as string)) as T[];
}

export async function getOne<T>(store: keyof AppSchema, id: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get(store as string, id)) as T | undefined;
}

export async function put<T>(store: keyof AppSchema, value: T): Promise<void> {
  const db = await getDb();
  await db.put(store as string, value as never);
}

export async function del(store: keyof AppSchema, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(store as string, id);
}

export const uid = (): string =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));