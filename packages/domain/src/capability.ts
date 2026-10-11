import { z } from "zod";
import { SystemIdSchema } from "./system.js";

/** Extensible capability kinds — UI renders from these, not device manufacturers. */
export const CAPABILITY_KINDS = [
  "temperature",
  "humidity",
  "pressure",
  "battery",
  "voltage",
  "current",
  "power",
  "energy",
  "co2",
  "pm1",
  "pm25",
  "pm10",
  "number",
  "switch",
  "brightness",
  "colour",
  "motion",
  "door",
  "lock",
  "camera",
  "alarm",
  "weather",
  "gps",
  "binary_sensor",
  "enum",
  "text",
  "json",
] as const;

export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];

export const CapabilityKindSchema = z.enum(CAPABILITY_KINDS);

export const CapabilityQualitySchema = z.enum([
  "good",
  "stale",
  "unknown",
  "error",
]);

export type CapabilityQuality = z.infer<typeof CapabilityQualitySchema>;

/** Live or snapshot state for one capability. */
export const CapabilityStateSchema = z.object({
  value: z.unknown().nullable(),
  unit: z.string().optional(),
  quality: CapabilityQualitySchema.default("unknown"),
  updatedAt: z.string().datetime().optional(),
});

export type CapabilityState = z.infer<typeof CapabilityStateSchema>;

/** Metadata for a capability (config plane — PostgreSQL). */
export const CapabilityMetaSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  kind: CapabilityKindSchema,
  name: z.string().min(1),
  unit: z.string().optional(),
  /** V4 — owning System (meaning layer). */
  systemId: SystemIdSchema.optional(),
  /** V4 — denormalised Area (rooms table). */
  areaId: z.string().uuid().optional(),
  /** V4 — optional Group within Area + System. */
  groupId: z.string().uuid().nullable().optional(),
  /** V4 — future Service subdivision within System. */
  serviceId: z.string().nullable().optional(),
});

export type CapabilityMeta = z.infer<typeof CapabilityMetaSchema>;

/** V4 capability row — all ownership fields required after classification. */
export const V4CapabilityMetaSchema = CapabilityMetaSchema.extend({
  systemId: SystemIdSchema,
  areaId: z.string().uuid().optional(),
});

export type V4CapabilityMeta = z.infer<typeof V4CapabilityMetaSchema>;

/** ESPHome internal GPIO outputs / status LEDs — not user-facing relays. */
export function isInternalRelayEntity(
  name: string,
  entityId?: string | null
): boolean {
  const n = name.trim().toLowerCase();
  const id = (entityId ?? "").trim().toLowerCase();
  if (id.startsWith("output_") || id.startsWith("led_")) return true;
  if (/^output\s/.test(n)) return true;
  if (n === "red" || n === "green") return true;
  return false;
}

/** Switch capabilities that can be toggled from the dashboard (not internal GPIO). */
export function isUserControllableSwitch(
  kind: string,
  hasCommand: boolean,
  name: string,
  entityId?: string | null
): boolean {
  if (kind !== "switch") return false;
  if (!hasCommand) return false;
  return !isInternalRelayEntity(name, entityId);
}
