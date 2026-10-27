import { openDB, type IDBPDatabase } from "idb";
import { DB_VERSION, STORE_NAMES, type BackupTables, type StoreName } from "./stores";

/** IndexedDB-Speicher: Demo-Modus und Lovable-Vorschau (kein VITE_API_URL gesetzt). */
export const DB_NAME = "energiegenossenschaft";

let dbPromise: Promise<IDBPDatabase<unknown>> | null = null;

export function getDb(): Promise<IDBPDatabase<unknown>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB nicht verfügbar"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await getDb();
  return (await db.getAll(store)) as T[];
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get(store, id)) as T | undefined;
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const db = await getDb();
  await db.put(store, value as never);
}

export async function del(store: StoreName, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(store, id);
}

export async function countAll(): Promise<Record<StoreName, number>> {
  const db = await getDb();
  const counts = await Promise.all(
    STORE_NAMES.map(async (name) => [name, await db.count(name)] as const),
  );
  return Object.fromEntries(counts) as Record<StoreName, number>;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

export async function exportTables(): Promise<BackupTables> {
  const db = await getDb();
  const tables: BackupTables = {};
  for (const name of STORE_NAMES) {
    const rows = (await db.getAll(name)) as Record<string, unknown>[];
    tables[name] =
      name === "documentFiles"
        ? await Promise.all(
            rows.map(async (r) => ({ id: r.id, dataUrl: await blobToDataUrl(r.blob as Blob) })),
          )
        : rows;
  }
  return tables;
}

/** Ersetzt ALLE Daten durch die übergebenen Tabellen (Sicherungsformat). */
export async function importTables(tables: BackupTables): Promise<void> {
  const db = await getDb();
  const prepared: BackupTables = {};
  for (const name of STORE_NAMES) {
    const rows = (tables[name] ?? []) as Record<string, unknown>[];
    prepared[name] =
      name === "documentFiles"
        ? await Promise.all(
            rows.map(async (r) => ({
              id: r.id,
              blob: await (await fetch(r.dataUrl as string)).blob(),
            })),
          )
        : rows;
  }
  const tx = db.transaction([...STORE_NAMES], "readwrite");
  for (const name of STORE_NAMES) {
    const store = tx.objectStore(name);
    await store.clear();
    for (const row of prepared[name]) await store.put(row as never);
  }
  await tx.done;
}
