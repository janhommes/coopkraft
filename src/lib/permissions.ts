import type { AppUser, Role } from "./types";

export function hasRole(user: AppUser | null, role: Role): boolean {
  return !!user && user.roles.includes(role);
}

export function hasAnyRole(user: AppUser | null, roles: Role[]): boolean {
  return !!user && roles.some((r) => user.roles.includes(r));
}

export type Action =
  | "view:dashboard"
  | "view:members"
  | "edit:member"
  | "create:member"
  | "approve:membership"
  | "confirm:payment"
  | "manage:documents:global"
  | "upload:document:member"
  | "manage:campaigns"
  | "run:dividends"
  | "run:sepa"
  | "manage:transfers"
  | "approve:termination"
  | "delete:member"
  | "manage:admin";

export function can(user: AppUser | null, action: Action): boolean {
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  switch (action) {
    case "view:dashboard":
      return true;
    case "view:members":
      return hasAnyRole(user, [
        "mitgliederverwalter",
        "vorstand",
        "aufsichtsrat",
        "mitgliedsbestaetiger",
        "zahlungspruefer",
        "kommunikation",
        "auszahler",
      ]);
    case "edit:member":
    case "create:member":
      return hasRole(user, "mitgliederverwalter");
    case "approve:membership":
      return hasAnyRole(user, ["mitgliedsbestaetiger", "aufsichtsrat"]);
    case "confirm:payment":
      return hasRole(user, "zahlungspruefer");
    case "manage:documents:global":
      return hasRole(user, "kommunikation");
    case "upload:document:member":
      return hasAnyRole(user, ["mitgliederverwalter", "vorstand"]);
    case "manage:campaigns":
      return hasRole(user, "kommunikation");
    case "run:dividends":
      return hasAnyRole(user, ["vorstand", "auszahler"]);
    case "run:sepa":
      return hasRole(user, "auszahler");
    case "manage:transfers":
      return hasAnyRole(user, ["mitgliederverwalter", "vorstand"]);
    case "approve:termination":
      return hasAnyRole(user, ["mitgliederverwalter", "vorstand"]);
    case "delete:member":
      return false; // nur Admin (oben abgefangen)
    case "manage:admin":
      return false;
  }
}