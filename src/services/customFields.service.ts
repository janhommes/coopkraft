import { getAll, put, del } from "./db";
import type { CustomFieldDef } from "@/lib/types";

export const listCustomFields = (): Promise<CustomFieldDef[]> => getAll<CustomFieldDef>("customFields");
export const saveCustomField = (f: CustomFieldDef): Promise<void> => put("customFields", f);
export const deleteCustomField = (id: string): Promise<void> => del("customFields", id);