import type { PluginManifest } from "@nexternel/plugin-sdk";

/** Built-in plugin manifests — empty; example plugins removed in V5.2. */
export const BUILTIN_PLUGIN_MANIFESTS: readonly PluginManifest[] = [];

export function getBuiltinPluginManifest(_id: string): PluginManifest | undefined {
  return undefined;
}
