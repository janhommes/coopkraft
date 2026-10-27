import * as idb from "./db.idb";
import * as rest from "./db.rest";

export { DB_VERSION, STORE_NAMES, type AppSchema, type StoreName } from "./stores";

/**
 * Speicher-Weiche: ohne VITE_API_URL (Lovable-Vorschau, Demo) IndexedDB im Browser,
 * mit VITE_API_URL das PHP-Backend. Beide Adapter haben dieselben Signaturen.
 */
export const isRemote = !!import.meta.env.VITE_API_URL;
const impl = isRemote ? rest : idb;

export const getAll: typeof idb.getAll = impl.getAll;
export const getOne: typeof idb.getOne = impl.getOne;
export const put: typeof idb.put = impl.put;
export const del: typeof idb.del = impl.del;
export const countAll: typeof idb.countAll = impl.countAll;
export const exportTables: typeof idb.exportTables = impl.exportTables;
export const importTables: typeof idb.importTables = impl.importTables;

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
