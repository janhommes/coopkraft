import { getAll, getOne, put, del } from "./db";
import type { CustomFieldDef } from "@/lib/types";

export const listCustomFields = (): Promise<CustomFieldDef[]> => getAll<CustomFieldDef>("customFields");
export const saveCustomField = (f: CustomFieldDef): Promise<void> => put("customFields", f);

export async function deleteCustomField(id: string): Promise<void> {
  const existing = await getOne<CustomFieldDef>("customFields", id);
  if (existing?.system) throw new Error("System-Felder können nicht gelöscht werden");
  return del("customFields", id);
}

/** Liefert pro Pflichtfeld einen Fehler-Key, wenn der Wert leer/false ist. */
export function validateCustomFields(
  values: Record<string, unknown>,
  defs: CustomFieldDef[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const def of defs) {
    if (!def.required) continue;
    const v = values?.[def.key];
    if (def.type === "checkbox") {
      if (v !== true) errors[def.key] = `${def.label} ist erforderlich`;
    } else if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      errors[def.key] = `${def.label} ist erforderlich`;
    }
  }
  return errors;
}

/** System-Custom-Fields, die parallel zu nativen Member-Feldern existieren. */
export const SYSTEM_FIELD_KEYS = [
  "titel",
  "bevorzugteAnrede",
  "firma",
  "geburtsdatum",
  "telefon",
  "newsletter",
] as const;

export const SYSTEM_FIELD_DEFS: CustomFieldDef[] = [
  { id: "system-titel", key: "titel", label: "Titel", type: "text", required: false, showOnSignup: true, system: true },
  { id: "system-bevorzugteAnrede", key: "bevorzugteAnrede", label: "Bevorzugte Anrede", type: "text", required: false, showOnSignup: false, system: true },
  { id: "system-firma", key: "firma", label: "Firma", type: "text", required: false, showOnSignup: true, system: true },
  { id: "system-geburtsdatum", key: "geburtsdatum", label: "Geburtsdatum", type: "date", required: false, showOnSignup: true, system: true },
  { id: "system-telefon", key: "telefon", label: "Telefon", type: "text", required: false, showOnSignup: true, system: true },
  { id: "system-newsletter", key: "newsletter", label: "Newsletter abonnieren", type: "checkbox", required: false, showOnSignup: true, system: true },
];

/** Legt System-Felder idempotent an. Bestehende user-Edits (Label/Required) bleiben erhalten. */
export async function ensureSystemCustomFields(): Promise<void> {
  for (const def of SYSTEM_FIELD_DEFS) {
    const existing = await getOne<CustomFieldDef>("customFields", def.id);
    if (!existing) await put("customFields", def);
    else if (!existing.system) await put("customFields", { ...existing, system: true });
  }
}