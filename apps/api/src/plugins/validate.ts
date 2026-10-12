import {
  PLUGIN_PERMISSION_KEYS,
  type PluginApiVersion,
  type PluginManifest,
  type PluginPermissionRequests,
  type PluginSettingField,
  type PluginSettingType,
} from "@nexternel/plugin-sdk";

export const SUPPORTED_PLUGIN_API_VERSIONS: readonly PluginApiVersion[] = [1];

const SETTING_TYPES: readonly PluginSettingType[] = ["text", "secret", "number", "select", "toggle", "time"];

/** Plugin ids end up in folder names, device slugs and user names, so keep them plain. */
export const PLUGIN_ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const MAIN_RE = /^[\w-]+(\/[\w-]+)*\.m?js$/;
const SETTING_KEY_RE = /^[a-zA-Z]\w{0,39}$/;

export type ManifestValidationResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function validateSettings(raw: unknown, errors: string[]): PluginSettingField[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push("settings must be a list");
    return [];
  }
  const seen = new Set<string>();
  const fields: PluginSettingField[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      errors.push("each setting must be an object");
      continue;
    }
    const key = typeof item.key === "string" ? item.key : "";
    const type = item.type as PluginSettingType;
    const label = text(item.label, 80);
    if (!SETTING_KEY_RE.test(key)) errors.push(`setting key "${key}" must be letters, digits or _`);
    else if (seen.has(key)) errors.push(`setting key "${key}" is listed twice`);
    seen.add(key);
    if (!SETTING_TYPES.includes(type)) errors.push(`setting "${key}" has unknown type "${String(item.type)}"`);
    if (!label) errors.push(`setting "${key}" needs a label`);
    const field: PluginSettingField = { key, label: label ?? key, type };
    const help = text(item.help, 300);
    if (help) field.help = help;
    if (item.required === true) field.required = true;
    if (["string", "number", "boolean"].includes(typeof item.default)) {
      if (type === "secret") errors.push(`secret setting "${key}" cannot have a default`);
      else field.default = item.default as string | number | boolean;
    }
    if (type === "select") {
      const options = Array.isArray(item.options)
        ? item.options.filter(
            (o): o is { value: string; label: string } =>
              isRecord(o) && typeof o.value === "string" && typeof o.label === "string"
          )
        : [];
      if (options.length === 0) errors.push(`select setting "${key}" needs options`);
      field.options = options.map((o) => ({ value: o.value, label: o.label }));
    }
    if (type === "number") {
      if (typeof item.min === "number") field.min = item.min;
      if (typeof item.max === "number") field.max = item.max;
    }
    fields.push(field);
  }
  return fields;
}

function validatePermissions(raw: unknown, errors: string[]): PluginPermissionRequests {
  if (raw === undefined) return {};
  if (!isRecord(raw)) {
    errors.push("permissions must be an object");
    return {};
  }
  const out: PluginPermissionRequests = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!PLUGIN_PERMISSION_KEYS.includes(key as keyof PluginPermissionRequests)) {
      errors.push(`unknown permission "${key}"`);
      continue;
    }
    const reason = text(value, 200);
    if (!reason) {
      errors.push(`permission "${key}" needs a short reason the person installing can read`);
      continue;
    }
    out[key as keyof PluginPermissionRequests] = reason;
  }
  return out;
}

export function validatePluginManifest(raw: unknown): ManifestValidationResult {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return { ok: false, errors: ["Manifest must be a JSON object"] };
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!PLUGIN_ID_RE.test(id)) {
    errors.push("id must be 2–40 lowercase letters, digits or dashes");
  }

  const version = typeof raw.version === "string" ? raw.version.trim() : "";
  if (!VERSION_RE.test(version)) {
    errors.push("version must look like 1.0.0");
  }

  const pluginApi = raw.pluginApi;
  if (
    typeof pluginApi !== "number" ||
    !SUPPORTED_PLUGIN_API_VERSIONS.includes(pluginApi as PluginApiVersion)
  ) {
    errors.push(`pluginApi must be one of: ${SUPPORTED_PLUGIN_API_VERSIONS.join(", ")}`);
  }

  const name = text(raw.name, 60);
  if (!name) errors.push("name is required");

  const main = raw.main === undefined ? "main.mjs" : typeof raw.main === "string" ? raw.main : "";
  if (!MAIN_RE.test(main)) errors.push("main must be a .mjs or .js file inside the package");

  const minNexternel = text(raw.minNexternel, 20);
  if (minNexternel && !/^V\d+\.\d+\.\d+$/.test(minNexternel)) {
    errors.push("minNexternel must look like V5.2.86");
  }

  const permissions = validatePermissions(raw.permissions, errors);
  const settings = validateSettings(raw.settings, errors);

  let contributes: PluginManifest["contributes"];
  if (raw.contributes !== undefined) {
    if (!isRecord(raw.contributes)) {
      errors.push("contributes must be an object");
    } else {
      const panelTypes = [
        ...(Array.isArray(raw.contributes.widgets) ? raw.contributes.widgets : []),
        ...(Array.isArray(raw.contributes.panels) ? raw.contributes.panels : []),
      ];
      for (const t of panelTypes) {
        if (typeof t !== "string" || !t.startsWith("plugin.")) {
          errors.push(`contributed panel type "${String(t)}" must use the plugin.* namespace`);
        }
      }
      contributes = { panels: panelTypes.filter((t): t is string => typeof t === "string") };
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const manifest: PluginManifest = {
    id,
    version,
    pluginApi: pluginApi as PluginApiVersion,
    name,
    description: text(raw.description, 500),
    author: text(raw.author, 80),
    main,
    minNexternel,
    permissions,
    settings,
    contributes,
  };
  return { ok: true, manifest };
}

/** "V5.2.86" ≥ "V5.2.80" → true. */
export function nexternelVersionAtLeast(current: string, minimum: string | undefined): boolean {
  if (!minimum) return true;
  const parse = (v: string) => v.replace(/^V/, "").split(".").map((n) => Number(n) || 0);
  const a = parse(current);
  const b = parse(minimum);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}
