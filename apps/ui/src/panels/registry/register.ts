import { migrateContributionPanelType } from "@nexternel/domain";
import type { PanelContribution } from "@nexternel/plugin-sdk";
import { sizingFromContribution } from "./sizing";
import { registerPanelRegistration, unregisterPanelRegistration } from "./store";
import type { PanelDescriptor, PanelImplementation, PanelRegistration, PanelRendererClass } from "./types";
import { isPanelRendererClass } from "./types";

function contributionSource(type: string): "contribution" | "plugin" {
  const migrated = migrateContributionPanelType(type);
  return migrated.startsWith("plugin.") ? "plugin" : "contribution";
}

function resolveContributionRendererClass(contribution: PanelContribution): PanelRendererClass {
  const declared = contribution.rendererClass;
  if (declared && isPanelRendererClass(declared)) {
    return declared;
  }
  return "composite-tile";
}

type ContributionRegistration = PanelContribution & {
  description?: string;
  sortOrder?: number;
  userSelectable?: boolean;
};

export function registerContributionPanel(contribution: PanelContribution): void {
  const meta = contribution as ContributionRegistration;
  const type = migrateContributionPanelType(contribution.type);
  const source = contributionSource(type);
  const rendererClass = resolveContributionRendererClass(contribution);
  const descriptor: PanelDescriptor = {
    type,
    label: contribution.label,
    description: meta.description ?? contribution.label,
    category: contribution.category ?? (source === "plugin" ? "plugins" : "sensors"),
    source,
    configSchemaVersion: 1,
    sizing: sizingFromContribution(contribution.defaultSize, rendererClass),
    responsive: {
      supportedStates: ["comfortable", "compact", "summary", "insufficient"],
    },
    accessibility: {
      label: contribution.label,
      role: "region",
    },
    userSelectable: meta.userSelectable ?? true,
    sortOrder: meta.sortOrder ?? (source === "plugin" ? 2000 : 1100),
    needsCapability: contribution.needsCapability ?? true,
    bindingSlots: contribution.bindingSlots,
    rendererClass,
  };

  const implementation: PanelImplementation = {
    kind: "contribution",
    rendererClass,
    Component: contribution.Component,
  };

  const entry: PanelRegistration = { descriptor, implementation };
  registerPanelRegistration(type, entry);
  if (type !== contribution.type) {
    registerPanelRegistration(contribution.type, entry);
  }
}

export function unregisterContributionPanel(type: string): void {
  unregisterPanelRegistration(type);
  const migrated = migrateContributionPanelType(type);
  if (migrated !== type) unregisterPanelRegistration(migrated);
}
