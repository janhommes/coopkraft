import { getAll, getOne, put, del, uid } from "./db";
import type { AppUser, DocumentFile, DocumentRecord } from "@/lib/types";
import { logAudit } from "./audit.service";

export const listDocuments = (): Promise<DocumentRecord[]> => getAll<DocumentRecord>("documents");
export const getDocument = (id: string): Promise<DocumentRecord | undefined> =>
  getOne<DocumentRecord>("documents", id);
export const getDocumentFile = (id: string): Promise<DocumentFile | undefined> =>
  getOne<DocumentFile>("documentFiles", id);

export async function uploadDocument(
  meta: Omit<DocumentRecord, "id" | "uploadedAt" | "uploadedBy" | "fileName" | "mimeType" | "size">,
  file: File,
  user: AppUser,
): Promise<DocumentRecord> {
  const rec: DocumentRecord = {
    ...meta,
    id: uid(),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy: user.name,
  };
  await put("documents", rec);
  await put("documentFiles", { id: rec.id, blob: file });
  await logAudit(user, meta.memberId ? "Mitglieds-Dokument hochgeladen" : "Globales Dokument hochgeladen", rec.title, meta.memberId);
  return rec;
}

export async function deleteDocument(id: string, user: AppUser): Promise<void> {
  const doc = await getDocument(id);
  await del("documents", id);
  await del("documentFiles", id);
  await logAudit(user, "Dokument gelöscht", doc?.title, doc?.memberId);
}

export async function downloadDocument(id: string): Promise<{ url: string; doc: DocumentRecord } | undefined> {
  const doc = await getDocument(id);
  const file = await getDocumentFile(id);
  if (!doc || !file) return undefined;
  return { url: URL.createObjectURL(file.blob), doc };
}

export async function getPublicDocumentBySlug(slug: string): Promise<DocumentRecord | undefined> {
  const all = await listDocuments();
  return all.find((d) => d.visibility === "public" && d.slug === slug && !d.memberId);
}