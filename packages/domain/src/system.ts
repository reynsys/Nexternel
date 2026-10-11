import { z } from "zod";

/** Stable product vocabulary — see docs/v3/08-SYSTEM-CATALOGUE.md */
export const SYSTEM_IDS = [
  "lighting",
  "climate",
  "security",
  "water",
  "energy",
  "environment",
  "entertainment",
  "appliances",
  "garden",
  "health",
  "network",
  "vehicles",
] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];

export const SystemIdSchema = z.enum(SYSTEM_IDS);

export const SYSTEM_TIERS = ["core", "extended", "future", "deprecated"] as const;
export type SystemTier = (typeof SYSTEM_TIERS)[number];

export const SystemTierSchema = z.enum(SYSTEM_TIERS);

/** Systems hidden from normal operator UI (row may remain for FK compatibility). */
export const OPERATOR_HIDDEN_SYSTEM_IDS: ReadonlySet<SystemId> = new Set([
  "garden",
]);

/** Catalogue row (config plane — PostgreSQL `systems`). */
export const SystemCatalogEntrySchema = z.object({
  id: SystemIdSchema,
  label: z.string().min(1),
  tier: SystemTierSchema,
  sortOrder: z.number().int().default(0),
  pluginId: z.string().optional(),
});

export type SystemCatalogEntry = z.infer<typeof SystemCatalogEntrySchema>;

/** Built-in catalogue — mirrors db/migrations/012_v4_systems.sql seed (no Panel coupling). */
export const SYSTEM_CATALOG: readonly SystemCatalogEntry[] = [
  { id: "lighting", label: "Lights", tier: "core", sortOrder: 10 },
  { id: "climate", label: "Climate", tier: "core", sortOrder: 20 },
  { id: "security", label: "Security", tier: "core", sortOrder: 30 },
  { id: "water", label: "Water", tier: "core", sortOrder: 40 },
  { id: "energy", label: "Energy", tier: "core", sortOrder: 50 },
  { id: "environment", label: "Environment", tier: "core", sortOrder: 60 },
  {
    id: "entertainment",
    label: "Entertainment / Media",
    tier: "extended",
    sortOrder: 70,
  },
  { id: "appliances", label: "Appliances", tier: "extended", sortOrder: 80 },
  {
    id: "garden",
    label: "Garden",
    tier: "deprecated",
    sortOrder: 90,
  },
  { id: "health", label: "Health & wellness", tier: "future", sortOrder: 100 },
  { id: "network", label: "Network", tier: "extended", sortOrder: 110 },
  {
    id: "vehicles",
    label: "Vehicles",
    tier: "extended",
    sortOrder: 120,
  },
];

export function isSystemId(value: string): value is SystemId {
  return (SYSTEM_IDS as readonly string[]).includes(value);
}

export function isOperatorVisibleSystemId(id: string): id is SystemId {
  return isSystemId(id) && !OPERATOR_HIDDEN_SYSTEM_IDS.has(id);
}

export function getSystemCatalogEntry(id: SystemId): SystemCatalogEntry | undefined {
  return SYSTEM_CATALOG.find((s) => s.id === id);
}
