import { getAll, put, del, uid } from "./db";
import type { AppUser, Campaign } from "@/lib/types";
import { logAudit } from "./audit.service";

export const listCampaigns = (): Promise<Campaign[]> => getAll<Campaign>("campaigns");

export async function createCampaign(data: Omit<Campaign, "id" | "createdAt" | "createdBy">, user: AppUser): Promise<Campaign> {
  const c: Campaign = { ...data, id: uid(), createdAt: new Date().toISOString(), createdBy: user.name };
  await put("campaigns", c);
  await logAudit(user, `Kampagne erstellt (${c.type})`, c.subject);
  return c;
}

export async function deleteCampaign(id: string, user: AppUser): Promise<void> {
  await del("campaigns", id);
  await logAudit(user, "Kampagne gelöscht");
}