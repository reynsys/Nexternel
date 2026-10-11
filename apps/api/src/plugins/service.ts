import type { PluginManifest } from "@nexternel/plugin-sdk";
import { getPool } from "../db.js";
import { BUILTIN_PLUGIN_MANIFESTS } from "./builtin-manifests.js";
import { validatePluginManifest } from "./validate.js";

export type PluginRecord = {
  id: string;
  name: string;
  description: string;
  version: string;
  pluginApi: number;
  enabled: boolean;
  builtin: boolean;
  source: "builtin" | "package";
  packagePath: string | null;
  contributes: PluginManifest["contributes"];
  runtimeLoaded: boolean;
};

type DbRow = {
  id: string;
  enabled: boolean;
  builtin: boolean;
  source: string;
  package_path: string | null;
  manifest: PluginManifest;
};

function rowToRecord(row: DbRow): PluginRecord {
  const manifest = row.manifest;
  return {
    id: row.id,
    name: manifest.name ?? manifest.id,
    description: manifest.description ?? "",
    version: manifest.version,
    pluginApi: manifest.pluginApi,
    enabled: row.enabled,
    builtin: row.builtin,
    source: row.source === "package" ? "package" : "builtin",
    packagePath: row.package_path,
    contributes: manifest.contributes,
    runtimeLoaded: row.builtin && row.enabled,
  };
}

export async function seedBuiltinPlugins(): Promise<number> {
  let seeded = 0;
  for (const manifest of BUILTIN_PLUGIN_MANIFESTS) {
    const validated = validatePluginManifest(manifest);
    if (!validated.ok) {
      throw new Error(
        `Invalid built-in plugin manifest ${manifest.id}: ${validated.errors.join("; ")}`
      );
    }
    const result = await getPool().query(
      `INSERT INTO installed_plugins (id, enabled, builtin, source, manifest)
       VALUES ($1, TRUE, TRUE, 'builtin', $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         manifest = EXCLUDED.manifest,
         builtin = TRUE,
         source = 'builtin',
         updated_at = NOW()
       WHERE installed_plugins.manifest IS DISTINCT FROM EXCLUDED.manifest`,
      [validated.manifest.id, JSON.stringify(validated.manifest)]
    );
    seeded += result.rowCount ?? 0;
  }
  return seeded;
}

export async function listPluginRecords(): Promise<PluginRecord[]> {
  const res = await getPool().query<DbRow>(
    `SELECT id, enabled, builtin, source, package_path, manifest
     FROM installed_plugins
     ORDER BY builtin DESC, id ASC`
  );
  return res.rows.map(rowToRecord);
}

export async function setPluginEnabled(
  id: string,
  enabled: boolean
): Promise<PluginRecord | null> {
  const res = await getPool().query<DbRow>(
    `UPDATE installed_plugins
     SET enabled = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, enabled, builtin, source, package_path, manifest`,
    [id, enabled]
  );
  const row = res.rows[0];
  return row ? rowToRecord(row) : null;
}

export type InstallPluginResult =
  | { ok: true; plugin: PluginRecord; runtimeLoadSupported: false; message: string }
  | { ok: false; errors: string[] };

/**
 * Register an external plugin manifest for future runtime loading.
 * Does not load executable code — bundled built-ins remain the only runtime panels.
 */
export async function installPluginManifest(
  raw: unknown,
  packagePath?: string | null
): Promise<InstallPluginResult> {
  const validated = validatePluginManifest(raw);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }

  const manifest = validated.manifest;
  if (BUILTIN_PLUGIN_MANIFESTS.some((b) => b.id === manifest.id)) {
    return {
      ok: false,
      errors: [`Plugin ${manifest.id} is built-in and cannot be installed separately`],
    };
  }

  const res = await getPool().query<DbRow>(
    `INSERT INTO installed_plugins (id, enabled, builtin, source, package_path, manifest)
     VALUES ($1, FALSE, FALSE, 'package', $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       package_path = EXCLUDED.package_path,
       manifest = EXCLUDED.manifest,
       updated_at = NOW()
     RETURNING id, enabled, builtin, source, package_path, manifest`,
    [manifest.id, packagePath ?? null, JSON.stringify(manifest)]
  );

  const row = res.rows[0];
  if (!row) {
    return { ok: false, errors: ["Failed to persist plugin record"] };
  }

  return {
    ok: true,
    plugin: rowToRecord(row),
    runtimeLoadSupported: false,
    message:
      "Plugin manifest registered. External runtime loading is not available in this release; panel code cannot be loaded without rebuilding the application.",
  };
}

export async function removePlugin(id: string): Promise<boolean> {
  const builtin = BUILTIN_PLUGIN_MANIFESTS.some((b) => b.id === id);
  if (builtin) return false;

  const result = await getPool().query(
    `DELETE FROM installed_plugins WHERE id = $1 AND builtin = FALSE`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
