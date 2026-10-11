import {
  isContributionPanelType,
  isPluginPanelType,
  migrateContributionPanelType,
} from "@nexternel/domain";
import type { RuntimePanelInstance } from "../../lib/panel-compatibility/types";
import { normalizePanelKind } from "../../lib/panel-kind";
import { isEchartsWidgetType } from "../../widgets/echarts/config";
import { configSchemaSupported } from "./config-migration";
import { bootstrapV5PanelRegistry } from "./bootstrap";
import { getPanelRegistration } from "./store";
import type { PanelAvailability, ResolvedPanelRegistration } from "./types";

function lookupRegistration(type: string) {
  const migrated = migrateContributionPanelType(type);
  return getPanelRegistration(migrated) ?? getPanelRegistration(type);
}

function isCoreScopedPanelType(type: string): boolean {
  const migrated = migrateContributionPanelType(normalizePanelKind(type));
  if (isContributionPanelType(migrated)) return false;
  return migrated.startsWith("panel.") || type.startsWith("view.");
}

export function resolvePanelRegistration(
  panel: RuntimePanelInstance
): ResolvedPanelRegistration {
  bootstrapV5PanelRegistry();
  const type = panel.type;
  const configErrors: string[] = [];

  if (panel.compatibility.availability === "unknown") {
    return {
      type,
      descriptor: null,
      implementation: null,
      availability: "unknown",
      configErrors,
    };
  }

  if (panel.compatibility.availability === "unsupported_legacy") {
    return {
      type,
      descriptor: null,
      implementation: null,
      availability: "unsupported_legacy",
      configErrors,
    };
  }

  const entry = lookupRegistration(type);
  if (!entry) {
    if (isPluginPanelType(type)) {
      return {
        type,
        descriptor: null,
        implementation: null,
        availability: "plugin_missing",
        configErrors,
      };
    }
    if (isCoreScopedPanelType(type) || isEchartsWidgetType(type)) {
      return {
        type,
        descriptor: null,
        implementation: null,
        availability: "unknown",
        configErrors,
      };
    }
    return {
      type,
      descriptor: null,
      implementation: null,
      availability: "unknown",
      configErrors,
    };
  }

  if (!configSchemaSupported(entry.descriptor, panel.config.schemaVersion)) {
    configErrors.push(
      `Unsupported configuration schema version ${panel.config.schemaVersion} for ${type}`
    );
    return {
      type,
      descriptor: entry.descriptor,
      implementation: entry.implementation,
      availability: "unsupported_config",
      configErrors,
    };
  }

  return {
    type,
    descriptor: entry.descriptor,
    implementation: entry.implementation,
    availability: "available",
    configErrors,
  };
}

export function resolvePanelRegistrationByType(type: string): ResolvedPanelRegistration {
  bootstrapV5PanelRegistry();
  const entry = lookupRegistration(type);
  if (!entry) {
    const availability: PanelAvailability = isPluginPanelType(type)
      ? "plugin_missing"
      : "unknown";
    return {
      type,
      descriptor: null,
      implementation: null,
      availability,
      configErrors: [],
    };
  }
  return {
    type,
    descriptor: entry.descriptor,
    implementation: entry.implementation,
    availability: "available",
    configErrors: [],
  };
}
