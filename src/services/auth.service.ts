import { isRemote } from "./db";
import { api, API_BASE } from "./db.rest";
import type { AppUser } from "@/lib/types";

/** "demo": Benutzer-Umschalter (IndexedDB). "sso": echte Anmeldung über das Backend. */
export type AuthMode = "demo" | "sso";
export const authMode: AuthMode = isRemote ? "sso" : "demo";

/** Angemeldeter Benutzer mit serverseitig aufgelösten Rollen (resolveRoles), sonst null. */
export async function getSession(): Promise<AppUser | null> {
  return (await api<{ user: AppUser | null }>("/me")).user;
}

export function login(returnTo = window.location.pathname + window.location.search): void {
  window.location.href = `${API_BASE}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function logout(): Promise<void> {
  await api("/auth/logout", { method: "POST" });
  window.location.href = "/";
}
