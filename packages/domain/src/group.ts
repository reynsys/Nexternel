import { z } from "zod";
import { SystemIdSchema } from "./system.js";

/** Optional UX bundle within Area + System — see docs/v3/07-DOMAIN-MODEL.md */
export const GroupMetaSchema = z.object({
  id: z.string().uuid(),
  areaId: z.string().uuid(),
  systemId: SystemIdSchema,
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isEnabled: z.boolean().default(true),
});

export type GroupMeta = z.infer<typeof GroupMetaSchema>;
