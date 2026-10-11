import type { PluginApiVersion, PluginManifest } from "@nexternel/plugin-sdk";

export const SUPPORTED_PLUGIN_API_VERSIONS: readonly PluginApiVersion[] = [1];

export type ManifestValidationResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePluginManifest(raw: unknown): ManifestValidationResult {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ["Manifest must be a JSON object"] };
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id || !/^[a-z0-9][a-z0-9.-]*$/i.test(id)) {
    errors.push("id must be a non-empty stable identifier");
  }

  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  if (!version) {
    errors.push("version is required");
  }

  const pluginApi = raw.pluginApi;
  if (
    typeof pluginApi !== "number" ||
    !SUPPORTED_PLUGIN_API_VERSIONS.includes(pluginApi as PluginApiVersion)
  ) {
    errors.push(
      `pluginApi must be one of: ${SUPPORTED_PLUGIN_API_VERSIONS.join(", ")}`
    );
  }

  if (!isRecord(raw.contributes)) {
    errors.push("contributes object is required");
  }

  const contributes = isRecord(raw.contributes) ? raw.contributes : {};
  const widgetTypes = [
    ...(Array.isArray(contributes.widgets) ? contributes.widgets : []),
    ...(Array.isArray(contributes.panels) ? contributes.panels : []),
  ];
  if (widgetTypes.length === 0) {
    errors.push("contributes.widgets or contributes.panels must list at least one panel type");
  }
  for (const t of widgetTypes) {
    if (typeof t !== "string" || !t.trim()) {
      errors.push("contributed panel type ids must be non-empty strings");
      break;
    }
    if (!t.startsWith("plugin.")) {
      errors.push(`contributed panel type "${String(t)}" must use plugin.* namespace`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : undefined;
  const description =
    typeof raw.description === "string" ? raw.description : undefined;

  const manifest: PluginManifest = {
    id,
    version,
    pluginApi: pluginApi as PluginApiVersion,
    name,
    description,
    contributes: {
      widgets: widgetTypes,
      drivers: Array.isArray(contributes.drivers)
        ? contributes.drivers.filter((d): d is string => typeof d === "string")
        : undefined,
      services: Array.isArray(contributes.services)
        ? contributes.services.filter((s): s is string => typeof s === "string")
        : undefined,
      navigation: Array.isArray(contributes.navigation)
        ? contributes.navigation.filter((n): n is string => typeof n === "string")
        : undefined,
      themes: Array.isArray(contributes.themes)
        ? contributes.themes.filter((t): t is string => typeof t === "string")
        : undefined,
    },
  };

  return { ok: true, manifest };
}
