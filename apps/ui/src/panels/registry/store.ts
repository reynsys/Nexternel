import type { PanelRegistration } from "./types";

const registrations = new Map<string, PanelRegistration>();

export function registerPanelRegistration(type: string, entry: PanelRegistration): void {
  registrations.set(type, entry);
}

export function unregisterPanelRegistration(type: string): void {
  registrations.delete(type);
}

export function getPanelRegistration(type: string): PanelRegistration | undefined {
  return registrations.get(type);
}

export function listPanelRegistrations(): PanelRegistration[] {
  return Array.from(registrations.values());
}

export function clearPanelRegistrations(): void {
  registrations.clear();
}
