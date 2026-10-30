import { normalizePluginBell, type PluginBell } from "../notifications/service.js";
import type {
  PluginGrants,
  PluginManifest,
  PluginPanelDef,
  PluginPermissionRequests,
  PluginSettingField,
} from "@nexternel/plugin-sdk";
import { getPool } from "../db.js";
import { APP_VERSION } from "../version.js";
import { clearPluginEvents } from "./events.js";
import { removePluginDevices, setPluginDevicesOnline } from "./devices.js";
import {
  downloadCatalogPackage,
  extractPackage,
  fetchCatalog,
  inspectPackage,
  packageInstalled,
  removePackages,
  sha256,
  type CatalogEntry,
} from "./packages.js";
import { decryptSecret, encryptSecret, hashToken, isEncryptedSecret, newPluginToken } from "./secrets.js";
import { nexternelVersionAtLeast } from "./validate.js";

export type PluginSource = "catalog" | "file";

export function pluginPanelType(pluginId: string, panelId: string): string {
  return `plugin.${pluginId}.${panelId}`;
}
/** What the plugin container says about the plugin's process. */
export type PluginRunState = "running" | "starting" | "stopped" | "crashed" | "waiting";

export type PluginSettingValue =
  | { type: "secret"; isSet: boolean; unreadable?: boolean }
  | { type: Exclude<PluginSettingField["type"], "secret">; value: string | number | boolean | null };

export type PluginRecord = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  source: PluginSource;
  enabled: boolean;
  status: PluginRunState;
  statusMessage: string | null;
  statusAt: string | null;
  permissions: PluginPermissionRequests;
  grants: PluginGrants;
  settingsFields: PluginSettingField[];
  settings: Record<string, PluginSettingValue>;
  missingSettings: string[];
  /** Dashboard panels the plugin offers; type = plugin.<id>.<panel id>. */
  panels: (PluginPanelDef & { type: string })[];
  /** Which of its messages reach the bell: all, important (keep an eye on it) or none. */
  bell: PluginBell;
  installedAt: string;
};

type DbRow = {
  id: string;
  enabled: boolean;
  source: string;
  manifest: PluginManifest;
  grants: Partial<PluginGrants>;
  settings: Record<string, unknown>;
  token_hash: string | null;
  config_rev: number;
  status: string;
  status_message: string | null;
  status_at: Date | null;
  installed_at: Date;
  package_sha256: string | null;
  bell: string;
};

const COLUMNS = `id, enabled, source, manifest, grants, settings, token_hash, config_rev, status, status_message,
  status_at, installed_at, package_sha256, bell`;

export function normalizeGrants(raw: Partial<PluginGrants> | undefined, requested: PluginPermissionRequests): PluginGrants {
  const read = raw?.read;
  return {
    devices: Boolean(requested.devices) && raw?.devices === true,
    read: !requested.read
      ? null
      : read === "all"
        ? "all"
        : Array.isArray(read)
          ? read.filter((a): a is string => typeof a === "string")
          : null,
    control: requested.control && Array.isArray(raw?.control)
      ? raw!.control.filter((c): c is string => typeof c === "string")
      : [],
    notify: Boolean(requested.notify) && raw?.notify === true,
  };
}

function settingValue(field: PluginSettingField, stored: unknown): PluginSettingValue {
  if (field.type === "secret") {
    if (!isEncryptedSecret(stored)) return { type: "secret", isSet: false };
    return decryptSecret(stored) === null ? { type: "secret", isSet: false, unreadable: true } : { type: "secret", isSet: true };
  }
  const value = stored === undefined ? field.default ?? null : (stored as string | number | boolean | null);
  return { type: field.type, value };
}

export function missingRequiredSettings(fields: PluginSettingField[], stored: Record<string, unknown>): string[] {
  return fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = stored[f.key] ?? f.default;
      if (f.type === "secret") return !(isEncryptedSecret(v) && decryptSecret(v) !== null);
      return v === undefined || v === null || v === "";
    })
    .map((f) => f.label);
}

function rowToRecord(row: DbRow): PluginRecord {
  const m = row.manifest;
  const fields = m.settings ?? [];
  const settings: Record<string, PluginSettingValue> = {};
  for (const f of fields) settings[f.key] = settingValue(f, row.settings[f.key]);
  return {
    id: row.id,
    name: m.name ?? m.id,
    version: m.version,
    description: m.description ?? "",
    author: m.author ?? "",
    source: row.source === "file" ? "file" : "catalog",
    enabled: row.enabled,
    status: (["running", "starting", "stopped", "crashed", "waiting"].includes(row.status) ? row.status : "stopped") as PluginRunState,
    statusMessage: row.status_message,
    statusAt: row.status_at ? row.status_at.toISOString() : null,
    permissions: m.permissions ?? {},
    grants: normalizeGrants(row.grants, m.permissions ?? {}),
    settingsFields: fields,
    settings,
    missingSettings: missingRequiredSettings(fields, row.settings),
    panels: (m.panels ?? []).map((p) => ({ ...p, type: pluginPanelType(m.id, p.id) })),
    bell: normalizePluginBell(row.bell),
    installedAt: row.installed_at.toISOString(),
  };
}

async function getRow(id: string): Promise<DbRow | null> {
  const res = await getPool().query<DbRow>(`SELECT ${COLUMNS} FROM installed_plugins WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function listPluginRecords(): Promise<PluginRecord[]> {
  const res = await getPool().query<DbRow>(`SELECT ${COLUMNS} FROM installed_plugins ORDER BY id`);
  return res.rows.map(rowToRecord);
}

export async function getPluginRecord(id: string): Promise<PluginRecord | null> {
  const row = await getRow(id);
  return row ? rowToRecord(row) : null;
}

export async function logPluginAction(pluginId: string, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  await getPool().query(
    `INSERT INTO plugin_action_log (plugin_id, action, detail) VALUES ($1, $2, $3::jsonb)`,
    [pluginId, action, JSON.stringify(detail)]
  );
}

export async function listPluginActions(pluginId: string, limit = 50) {
  const res = await getPool().query<{ action: string; detail: Record<string, unknown>; created_at: Date }>(
    `SELECT action, detail, created_at FROM plugin_action_log WHERE plugin_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [pluginId, limit]
  );
  return res.rows.map((r) => ({ action: r.action, detail: r.detail, at: r.created_at.toISOString() }));
}

export type InstallResult = { ok: true; plugin: PluginRecord } | { ok: false; errors: string[] };

/**
 * Install or update from package bytes. A new install starts with the permissions the person
 * approved; an update keeps the existing grants and settings (newly requested permissions start off).
 */
async function installFromBytes(
  data: Buffer,
  source: PluginSource,
  grantsOnInstall: Partial<PluginGrants> | undefined,
  expected?: { id: string; version: string }
): Promise<InstallResult> {
  const inspected = await inspectPackage(data);
  if (!inspected.ok) return inspected;
  const manifest = inspected.manifest;
  if (expected && (manifest.id !== expected.id || manifest.version !== expected.version)) {
    return { ok: false, errors: ["The package does not match the official list entry."] };
  }
  if (!nexternelVersionAtLeast(APP_VERSION, manifest.minNexternel)) {
    return { ok: false, errors: [`${manifest.name} needs Nexternel ${manifest.minNexternel} or newer (this is ${APP_VERSION}).`] };
  }
  const existing = await getRow(manifest.id);
  if (existing && existing.source === "catalog" && source === "file") {
    return { ok: false, errors: [`${manifest.name} is installed from the official list; remove it first to install a file copy.`] };
  }
  await extractPackage(manifest, inspected.zip);
  const grants = normalizeGrants(existing ? existing.grants : grantsOnInstall, manifest.permissions ?? {});
  const res = await getPool().query<DbRow>(
    `INSERT INTO installed_plugins (id, enabled, builtin, source, package_path, manifest, grants, package_sha256, status)
     VALUES ($1, TRUE, FALSE, $2, $3, $4::jsonb, $5::jsonb, $6, 'starting')
     ON CONFLICT (id) DO UPDATE SET
       manifest = EXCLUDED.manifest, package_path = EXCLUDED.package_path, package_sha256 = EXCLUDED.package_sha256,
       grants = EXCLUDED.grants, config_rev = installed_plugins.config_rev + 1, updated_at = NOW()
     RETURNING ${COLUMNS}`,
    [manifest.id, source, `packages/${manifest.id}/${manifest.version}`, JSON.stringify(manifest), JSON.stringify(grants), sha256(data)]
  );
  await logPluginAction(manifest.id, existing ? "updated" : "installed", { version: manifest.version, source });
  return { ok: true, plugin: rowToRecord(res.rows[0]!) };
}

export async function installFromCatalog(id: string, grants?: Partial<PluginGrants>): Promise<InstallResult> {
  const entry = (await fetchCatalog(true)).find((e) => e.id === id);
  if (!entry) return { ok: false, errors: [`${id} is not in the official plugin list.`] };
  try {
    const data = await downloadCatalogPackage(entry);
    return await installFromBytes(data, "catalog", grants, { id: entry.id, version: entry.version });
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : "Download failed"] };
  }
}

export async function installFromFile(data: Buffer, grants?: Partial<PluginGrants>): Promise<InstallResult> {
  return installFromBytes(data, "file", grants);
}

/** Read a package file's manifest so the install screen can show what it asks for. */
export async function previewPackage(data: Buffer) {
  const inspected = await inspectPackage(data);
  if (!inspected.ok) return inspected;
  return { ok: true as const, manifest: inspected.manifest };
}

export type CatalogListing = CatalogEntry & { installedVersion: string | null; updateAvailable: boolean; compatible: boolean };

export async function listCatalog(force = false): Promise<CatalogListing[]> {
  const [entries, installed] = await Promise.all([fetchCatalog(force), listPluginRecords()]);
  const byId = new Map(installed.map((p) => [p.id, p]));
  return entries.map((e) => {
    const mine = byId.get(e.id);
    return {
      ...e,
      installedVersion: mine?.version ?? null,
      updateAvailable: Boolean(mine && mine.source === "catalog" && mine.version !== e.version),
      compatible: nexternelVersionAtLeast(APP_VERSION, e.minNexternel),
    };
  });
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<PluginRecord | null> {
  const res = await getPool().query<DbRow>(
    `UPDATE installed_plugins SET enabled = $2, updated_at = NOW(),
       status = CASE WHEN $2 THEN 'starting' ELSE 'stopped' END, token_hash = CASE WHEN $2 THEN token_hash ELSE NULL END
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, enabled]
  );
  const row = res.rows[0];
  if (!row) return null;
  if (!enabled) {
    clearPluginEvents(id);
    await setPluginDevicesOnline(id, false);
  }
  await logPluginAction(id, enabled ? "switched-on" : "switched-off");
  return rowToRecord(row);
}

export async function setPluginGrants(id: string, raw: Partial<PluginGrants>): Promise<PluginRecord | null> {
  const row = await getRow(id);
  if (!row) return null;
  const grants = normalizeGrants(raw, row.manifest.permissions ?? {});
  const res = await getPool().query<DbRow>(
    `UPDATE installed_plugins SET grants = $2::jsonb, config_rev = config_rev + 1, updated_at = NOW()
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, JSON.stringify(grants)]
  );
  if (!grants.devices && row.grants.devices) await removePluginDevices(id);
  await logPluginAction(id, "permissions-changed", { grants });
  return rowToRecord(res.rows[0]!);
}

/** Which of the plugin's messages reach the bell. */
export async function setPluginBell(id: string, raw: unknown): Promise<PluginRecord | null> {
  const bell = normalizePluginBell(raw);
  const res = await getPool().query(`UPDATE installed_plugins SET bell = $2, updated_at = NOW() WHERE id = $1`, [id, bell]);
  if ((res.rowCount ?? 0) === 0) return null;
  await logPluginAction(id, "bell-changed", { bell });
  return getPluginRecord(id);
}

/** Check and store settings from the plugin's settings page. Secrets left empty keep their value. */
export async function savePluginSettings(
  id: string,
  input: Record<string, unknown>
): Promise<{ ok: true; plugin: PluginRecord } | { ok: false; errors: string[] }> {
  const row = await getRow(id);
  if (!row) return { ok: false, errors: ["Plugin not found"] };
  const fields = row.manifest.settings ?? [];
  const next: Record<string, unknown> = { ...row.settings };
  const errors: string[] = [];
  for (const f of fields) {
    if (!(f.key in input)) continue;
    const v = input[f.key];
    switch (f.type) {
      case "secret":
        if (v === null || v === "") delete next[f.key];
        else if (typeof v === "string") next[f.key] = encryptSecret(v.slice(0, 2000));
        break;
      case "text":
        if (typeof v !== "string") errors.push(`${f.label}: must be text`);
        else next[f.key] = v.slice(0, 1000);
        break;
      case "number": {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) errors.push(`${f.label}: must be a number`);
        else if (f.min !== undefined && n < f.min) errors.push(`${f.label}: at least ${f.min}`);
        else if (f.max !== undefined && n > f.max) errors.push(`${f.label}: at most ${f.max}`);
        else next[f.key] = n;
        break;
      }
      case "select":
        if (!f.options?.some((o) => o.value === v)) errors.push(`${f.label}: choose one of the options`);
        else next[f.key] = v;
        break;
      case "toggle":
        next[f.key] = v === true;
        break;
      case "time":
        if (typeof v !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) errors.push(`${f.label}: use HH:MM`);
        else next[f.key] = v;
        break;
    }
  }
  if (errors.length) return { ok: false, errors };
  const res = await getPool().query<DbRow>(
    `UPDATE installed_plugins SET settings = $2::jsonb, config_rev = config_rev + 1, updated_at = NOW()
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, JSON.stringify(next)]
  );
  await logPluginAction(id, "settings-changed", { keys: Object.keys(input).filter((k) => fields.some((f) => f.key === k)) });
  return { ok: true, plugin: rowToRecord(res.rows[0]!) };
}

/** Settings as the plugin sees them: secrets decrypted, defaults filled in. */
export function pluginSettingsForRuntime(manifest: PluginManifest, stored: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of manifest.settings ?? []) {
    const v = stored[f.key];
    if (f.type === "secret") out[f.key] = isEncryptedSecret(v) ? decryptSecret(v) : null;
    else out[f.key] = v === undefined ? f.default ?? null : v;
  }
  return out;
}

export async function removePlugin(id: string): Promise<boolean> {
  const res = await getPool().query(`DELETE FROM installed_plugins WHERE id = $1`, [id]);
  if ((res.rowCount ?? 0) === 0) return false;
  clearPluginEvents(id);
  logs.delete(id);
  await getPool().query(`DELETE FROM plugin_panel_content WHERE plugin_id = $1`, [id]);
  await removePluginDevices(id);
  await removePackages(id);
  await logPluginAction(id, "removed");
  return true;
}

// ---------- the plugin container's side ----------

export type DesiredPlugin = { id: string; version: string; main: string; folder: string; configRev: number };

/** Plugins that should be running now. */
export async function desiredPlugins(): Promise<DesiredPlugin[]> {
  const rows = (await getPool().query<DbRow>(`SELECT ${COLUMNS} FROM installed_plugins WHERE enabled = TRUE`)).rows;
  const out: DesiredPlugin[] = [];
  for (const row of rows) {
    const m = row.manifest;
    const missing = missingRequiredSettings(m.settings ?? [], row.settings);
    if (missing.length > 0) {
      await setRunState(row.id, "waiting", `Needs settings: ${missing.join(", ")}`);
      continue;
    }
    if (!(await packageInstalled(m.id, m.version))) {
      void restoreMissingPackage(row);
      await setRunState(row.id, "waiting", "Downloading the plugin again…");
      continue;
    }
    out.push({ id: m.id, version: m.version, main: m.main ?? "main.mjs", folder: `packages/${m.id}/${m.version}`, configRev: row.config_rev });
  }
  return out;
}

const restoring = new Set<string>();

/** After a restore the package files may be missing; official ones are fetched again. */
async function restoreMissingPackage(row: DbRow): Promise<void> {
  if (restoring.has(row.id)) return;
  restoring.add(row.id);
  try {
    if (row.source !== "catalog") {
      await setRunState(row.id, "waiting", "Plugin files are missing; install the file again.");
      return;
    }
    const entry = (await fetchCatalog()).find((e) => e.id === row.id && e.version === row.manifest.version);
    if (!entry) {
      await setRunState(row.id, "waiting", "This version is no longer in the official list; update the plugin.");
      return;
    }
    const inspected = await inspectPackage(await downloadCatalogPackage(entry));
    if (inspected.ok) await extractPackage(inspected.manifest, inspected.zip);
  } catch (err) {
    await setRunState(row.id, "waiting", `Could not download the plugin again: ${err instanceof Error ? err.message : err}`);
  } finally {
    restoring.delete(row.id);
  }
}

/** A fresh token for one run of the plugin; the previous one stops working. */
export async function startPluginSession(id: string): Promise<string | null> {
  const token = newPluginToken(id);
  const res = await getPool().query(
    `UPDATE installed_plugins SET token_hash = $2 WHERE id = $1 AND enabled = TRUE`,
    [id, hashToken(token)]
  );
  return (res.rowCount ?? 0) > 0 ? token : null;
}

export async function setRunState(id: string, state: PluginRunState, message: string | null): Promise<void> {
  await getPool().query(
    `UPDATE installed_plugins SET status = $2, status_message = $3, status_at = NOW()
     WHERE id = $1 AND (status IS DISTINCT FROM $2 OR status_message IS DISTINCT FROM $3)`,
    [id, state, message]
  );
  if (state === "crashed" || state === "stopped") await setPluginDevicesOnline(id, false);
}

// Recent output lines per plugin, kept in memory for Settings → Extensions.
const LOG_LINES = 300;
const logs = new Map<string, { t: string; stream: string; line: string }[]>();

export function appendPluginLogs(id: string, lines: { t: string; stream: string; line: string }[]): void {
  const list = logs.get(id) ?? [];
  for (const l of lines) list.push({ t: l.t, stream: l.stream === "stderr" ? "stderr" : "stdout", line: String(l.line).slice(0, 1000) });
  if (list.length > LOG_LINES) list.splice(0, list.length - LOG_LINES);
  logs.set(id, list);
}

export function pluginLogs(id: string) {
  return logs.get(id) ?? [];
}
