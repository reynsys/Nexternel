/** Browser localStorage key for active UI skin id */
export const UI_SKIN_STORAGE_KEY = "nexternel.uiSkin";

export const DEFAULT_SKIN_ID = "mui-dashboard";

export function getActiveSkinId(): string {
  try {
    const v = localStorage.getItem(UI_SKIN_STORAGE_KEY);
    if (v && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  return DEFAULT_SKIN_ID;
}

export function setActiveSkinId(id: string): void {
  localStorage.setItem(UI_SKIN_STORAGE_KEY, id);
}
