import type { PluginManifest, PanelContribution } from "@nexternel/plugin-sdk";
import { migrateContributionPanelType } from "@nexternel/domain";
import {
  getPanelRegistration,
  listPanelRegistrations,
  registerContributionPanel,
  unregisterContributionPanel,
} from "../panels/registry";

const manifestsById = new Map<string, PluginManifest>();

/** @deprecated Transitional — V5 registry is authoritative. */
export function registerPlugin(manifest: PluginManifest) {
  manifestsById.set(manifest.id, manifest);
}

/** Registers into the V5 logical Panel Registry (LAW 013). */
export function registerPanel(contribution: PanelContribution) {
  registerContributionPanel(contribution);
}

/** @deprecated use registerPanel */
export function registerWidget(contribution: PanelContribution) {
  registerPanel(contribution);
}

export function unregisterPlugin(id: string) {
  const manifest = manifestsById.get(id);
  manifestsById.delete(id);
  for (const t of manifest?.contributes?.panels ?? manifest?.contributes?.widgets ?? []) {
    unregisterContributionPanel(t);
  }
}

export function getPanelContribution(type: string): PanelContribution | undefined {
  const migrated = migrateContributionPanelType(type);
  const entry = getPanelRegistration(migrated) ?? getPanelRegistration(type);
  if (!entry || entry.implementation.kind !== "contribution") return undefined;
  const Component = entry.implementation.Component;
  if (!Component) return undefined;
  return {
    type: entry.descriptor.type,
    label: entry.descriptor.label,
    category: entry.descriptor.category,
    needsCapability: entry.descriptor.needsCapability,
    bindingSlots: entry.descriptor.bindingSlots,
    rendererClass: entry.descriptor.rendererClass,
    defaultSize: entry.descriptor.sizing.preferredWidth
      ? {
          w: entry.descriptor.sizing.preferredWidth!,
          h: entry.descriptor.sizing.preferredHeight ?? 3,
        }
      : undefined,
    Component,
  };
}

/** @deprecated use getPanelContribution */
export function getWidgetContribution(type: string): PanelContribution | undefined {
  return getPanelContribution(type);
}

export function listPanelContributions(): PanelContribution[] {
  return listPanelRegistrations()
    .filter((entry) => entry.implementation.kind === "contribution")
    .map((entry) => getPanelContribution(entry.descriptor.type))
    .filter((item): item is PanelContribution => Boolean(item));
}

/** @deprecated use listPanelContributions */
export function listWidgetContributions(): PanelContribution[] {
  return listPanelContributions();
}

export function listPluginManifests(): PluginManifest[] {
  return Array.from(manifestsById.values());
}

export function getPluginManifest(id: string): PluginManifest | undefined {
  return manifestsById.get(id);
}

export function getPluginManifestForWidgetType(
  type: string
): PluginManifest | undefined {
  return listPluginManifests().find(
    (m) => m.contributes?.panels?.includes(type) || m.contributes?.widgets?.includes(type)
  );
}
