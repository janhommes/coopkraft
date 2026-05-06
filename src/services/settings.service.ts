import { getOne, put } from "./db";
import type { Settings, WorkflowConfig } from "@/lib/types";

const SETTINGS_KEY = "singleton";
const WORKFLOW_KEY = "singleton";

export async function getSettings(): Promise<Settings | undefined> {
  const wrap = await getOne<{ id: "singleton"; data: Settings }>("settings", SETTINGS_KEY);
  return wrap?.data;
}
export async function saveSettings(s: Settings): Promise<void> {
  await put("settings", { id: SETTINGS_KEY, data: s });
}

export async function getWorkflow(): Promise<WorkflowConfig | undefined> {
  const wrap = await getOne<{ id: "singleton"; data: WorkflowConfig }>("workflowConfig", WORKFLOW_KEY);
  return wrap?.data;
}
export async function saveWorkflow(w: WorkflowConfig): Promise<void> {
  await put("workflowConfig", { id: WORKFLOW_KEY, data: w });
}