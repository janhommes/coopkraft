import { DB_VERSION, type BackupTables, type StoreName } from "./stores";

/** REST-Speicher gegen das PHP-Backend (backend/). Aktiv, wenn VITE_API_URL gesetzt ist. */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "/api").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // Kennzeichnet Aufrufe der App; das Backend lehnt schreibende Requests ohne diesen Header ab (CSRF).
  headers.set("X-Requested-With", "coopkraft");
  if (typeof init.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const res = await fetch(API_BASE + path, { credentials: "same-origin", ...init, headers });
  if (!res.ok) {
    let message = `Serverfehler (${res.status})`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      /* kein JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const seg = (s: string) => encodeURIComponent(s);

export async function getAll<T>(store: StoreName): Promise<T[]> {
  if (store === "documentFiles") throw new Error("documentFiles nur einzeln abrufbar");
  return api<T[]>(`/data/${store}`);
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  try {
    if (store === "documentFiles") {
      const res = await fetch(`${API_BASE}/files/${seg(id)}`, { credentials: "same-origin" });
      if (res.status === 404) return undefined;
      if (!res.ok) throw new ApiError(res.status, `Datei nicht abrufbar (${res.status})`);
      return { id, blob: await res.blob() } as T;
    }
    return await api<T>(`/data/${store}/${seg(id)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return undefined;
    throw e;
  }
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  const row = value as { id: string; blob?: Blob };
  if (store === "documentFiles") {
    const blob = row.blob as Blob;
    await api(`/files/${seg(row.id)}`, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": blob.type || "application/octet-stream" },
    });
    return;
  }
  await api(`/data/${store}/${seg(row.id)}`, { method: "PUT", body: JSON.stringify(value) });
}

export async function del(store: StoreName, id: string): Promise<void> {
  await api(store === "documentFiles" ? `/files/${seg(id)}` : `/data/${store}/${seg(id)}`, {
    method: "DELETE",
  });
}

export const countAll = (): Promise<Record<StoreName, number>> => api("/admin/counts");

export async function exportTables(): Promise<BackupTables> {
  return (await api<{ tables: BackupTables }>("/admin/backup")).tables;
}

export async function importTables(tables: BackupTables): Promise<void> {
  await api("/admin/restore", {
    method: "POST",
    body: JSON.stringify({ format: "egv-backup", version: DB_VERSION, tables }),
  });
}
