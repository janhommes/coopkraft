import { getAll, put, uid } from "./db";
import type { AppUser, AuditEntry } from "@/lib/types";

export async function logAudit(
  user: AppUser | null,
  action: string,
  details?: string,
  memberId?: string,
): Promise<void> {
  const entry: AuditEntry = {
    id: uid(),
    memberId,
    userId: user?.id ?? "system",
    userName: user?.name ?? "System",
    action,
    details,
    at: new Date().toISOString(),
  };
  await put("auditLog", entry);
}

export async function listAudit(memberId?: string): Promise<AuditEntry[]> {
  const all = await getAll<AuditEntry>("auditLog");
  const filtered = memberId ? all.filter((a) => a.memberId === memberId) : all;
  return filtered.sort((a, b) => b.at.localeCompare(a.at));
}