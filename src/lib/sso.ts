import type { Member, Role } from "./types";

export interface SsoGroupMapping { group: string; roles: Role[] }
export interface SsoRoleConfig {
  claim: string;
  /** Was passiert, wenn keine Gruppe gemappt ist und kein Mitglied gefunden wird */
  unknownPolicy: "mitglied" | "deny";
  mappings: SsoGroupMapping[];
}
export interface SsoIdentity { email: string; groups: string[] }

export const DEFAULT_SSO_CONFIG: SsoRoleConfig = {
  claim: "groups",
  unknownPolicy: "deny",
  mappings: [
    { group: "egv-admin", roles: ["admin"] },
    { group: "egv-vorstand", roles: ["vorstand", "mitgliedsbestaetiger"] },
    { group: "egv-aufsichtsrat", roles: ["aufsichtsrat"] },
    { group: "egv-verwaltung", roles: ["mitgliederverwalter"] },
    { group: "egv-finanzen", roles: ["zahlungspruefer", "auszahler"] },
    { group: "egv-kommunikation", roles: ["kommunikation"] },
  ],
};

/** Reine Funktion – im Backend später identisch anwendbar (Claims serverseitig auswerten). */
export function resolveRoles(
  identity: SsoIdentity,
  config: SsoRoleConfig,
  members: Member[],
  overrides: Role[] = [],
): { roles: Role[]; memberId?: string } {
  const set = new Set<Role>(overrides);
  const groups = identity.groups.map((g) => g.trim().toLowerCase());
  for (const m of config.mappings) {
    if (groups.includes(m.group.trim().toLowerCase())) m.roles.forEach((r) => set.add(r));
  }
  const email = identity.email.trim().toLowerCase();
  const member = members.find(
    (m) => m.email?.toLowerCase() === email && (m.status === "active" || m.status === "terminating"),
  );
  if (member) set.add("mitglied");
  if (set.size === 0 && config.unknownPolicy === "mitglied") set.add("mitglied");
  return { roles: [...set], memberId: member?.id };
}
