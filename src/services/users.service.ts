import { getAll, getOne, put, del } from "./db";
import type { AppUser } from "@/lib/types";

export const listUsers = (): Promise<AppUser[]> => getAll<AppUser>("users");
export const getUser = (id: string): Promise<AppUser | undefined> => getOne<AppUser>("users", id);
export const saveUser = (u: AppUser): Promise<void> => put("users", u);
export const deleteUser = (id: string): Promise<void> => del("users", id);