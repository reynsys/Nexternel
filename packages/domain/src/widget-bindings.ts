import { z } from "zod";

/**
 * Panel capability bindings (persisted on `PanelInstance.bindings`).
 *
 * - `capabilityId` — primary capability (legacy single-cap panels)
 * - `capabilityIds` — ordered list (multi-series without named slots)
 * - `slots` — named capability slots for composite contributions
 * - `deviceIds` — device-scoped panels (e.g. relay board)
 * - `deviceId` — legacy single device; migrated to `deviceIds` on normalize
 * - `sourceId` / `sourceType` — optional integration source hints
 *
 * Additional keys are preserved for forward compatibility (e.g. plugin metadata).
 */
export const WidgetBindingsSchema = z.object({
  capabilityId: z.string().optional(),
  capabilityIds: z.array(z.string()).optional(),
  slots: z.record(z.string(), z.string()).optional(),
  deviceId: z.string().optional(),
  deviceIds: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
  sourceType: z.string().optional(),
});

export type WidgetBindings = z.infer<typeof WidgetBindingsSchema>;

/** @deprecated Use `WidgetBindings` — same persisted panel binding record. */
export type PanelBindings = WidgetBindings;

const KNOWN_BINDING_KEYS = new Set([
  "capabilityId",
  "capabilityIds",
  "slots",
  "deviceId",
  "deviceIds",
  "sourceId",
  "sourceType",
]);

function trimId(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function trimIdList(ids: unknown): string[] | undefined {
  if (!Array.isArray(ids)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const trimmed = trimId(id);
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out.length > 0 ? out : undefined;
}

function trimSlots(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const trimmed = trimId(value);
    if (trimmed) next[key] = trimmed;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Canonical panel bindings for runtime and persistence.
 * Normalizes known fields, migrates legacy `deviceId`, preserves unknown keys.
 * Idempotent for already-canonical input.
 */
export function normalizePanelBindings(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const record = raw as Record<string, unknown>;
  const preserved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!KNOWN_BINDING_KEYS.has(key)) preserved[key] = value;
  }

  let capabilityId =
    typeof record.capabilityId === "string" ? trimId(record.capabilityId) : undefined;
  const capabilityIds = trimIdList(record.capabilityIds);
  const slots = trimSlots(record.slots);

  let deviceIds = trimIdList(record.deviceIds);
  const legacyDeviceId =
    typeof record.deviceId === "string" ? trimId(record.deviceId) : undefined;
  if (legacyDeviceId) {
    const merged = deviceIds ?? [];
    if (!merged.includes(legacyDeviceId)) {
      deviceIds = [legacyDeviceId, ...merged];
    }
  }

  const sourceId = typeof record.sourceId === "string" ? trimId(record.sourceId) : undefined;
  const sourceType =
    typeof record.sourceType === "string" ? trimId(record.sourceType) : undefined;

  if (!capabilityId) {
    capabilityId =
      capabilityIds?.[0] ?? (slots ? Object.values(slots)[0] : undefined);
  }

  const out: Record<string, unknown> = { ...preserved };
  if (capabilityId) out.capabilityId = capabilityId;
  if (capabilityIds?.length) out.capabilityIds = capabilityIds;
  if (slots) out.slots = slots;
  if (deviceIds?.length) out.deviceIds = deviceIds;
  if (sourceId) out.sourceId = sourceId;
  if (sourceType) out.sourceType = sourceType;
  return out;
}

export function parseWidgetBindings(raw: unknown): WidgetBindings {
  const normalized = normalizePanelBindings(raw);
  const parsed = WidgetBindingsSchema.safeParse(normalized);
  return parsed.success ? parsed.data : {};
}

/** Primary capability for legacy single-cap widgets and title resolution. */
export function primaryCapabilityId(bindings: unknown): string | undefined {
  const b = parseWidgetBindings(bindings);
  if (typeof b.capabilityId === "string" && b.capabilityId.trim()) {
    return b.capabilityId.trim();
  }
  if (Array.isArray(b.capabilityIds)) {
    const first = b.capabilityIds.find((id) => typeof id === "string" && id.trim());
    if (first) return first.trim();
  }
  if (b.slots) {
    for (const id of Object.values(b.slots)) {
      if (typeof id === "string" && id.trim()) return id.trim();
    }
  }
  return undefined;
}

/** All bound capability ids (deduped, stable order). */
export function allCapabilityIds(bindings: unknown): string[] {
  const b = parseWidgetBindings(bindings);
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined) => {
    if (!id) return;
    const trimmed = trimId(id);
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      ids.push(trimmed);
    }
  };
  add(b.capabilityId);
  if (Array.isArray(b.capabilityIds)) {
    for (const id of b.capabilityIds) add(id);
  }
  if (b.slots) {
    for (const id of Object.values(b.slots)) add(id);
  }
  return ids;
}

/** Device ids for device-scoped panel bindings. */
export function deviceIdsFromBindings(bindings: unknown): string[] {
  const b = parseWidgetBindings(bindings);
  return b.deviceIds ?? [];
}

/** Named slot binding (composite widgets). */
export function getBindingSlot(bindings: unknown, slot: string): string | undefined {
  const b = parseWidgetBindings(bindings);
  const id = b.slots?.[slot];
  if (typeof id === "string" && id.trim()) return id.trim();
  if (slot === "primary") return primaryCapabilityId(b);
  return undefined;
}

/** Merge slot map into bindings; keeps legacy `capabilityId` when unset. */
export function mergeBindingSlots(
  bindings: unknown,
  slots: Record<string, string | undefined>
): WidgetBindings {
  const b = parseWidgetBindings(bindings);
  const nextSlots = { ...(b.slots ?? {}) };
  for (const [key, id] of Object.entries(slots)) {
    if (typeof id === "string" && id.trim()) nextSlots[key] = id.trim();
    else delete nextSlots[key];
  }
  const primary = primaryCapabilityId({ ...b, slots: nextSlots });
  return parseWidgetBindings({
    ...b,
    slots: Object.keys(nextSlots).length > 0 ? nextSlots : undefined,
    capabilityId: b.capabilityId ?? primary,
  });
}

/** Persist slots and set `capabilityId` to first slot for legacy readers. */
export function bindingsFromSlots(slots: Record<string, string>): WidgetBindings {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(slots)) {
    if (typeof v === "string" && v.trim()) cleaned[k] = v.trim();
  }
  const primary = Object.values(cleaned)[0];
  return parseWidgetBindings({
    slots: cleaned,
    ...(primary ? { capabilityId: primary } : {}),
  });
}
