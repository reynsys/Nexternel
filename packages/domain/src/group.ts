import { z } from "zod";
import { SystemIdSchema } from "./system.js";

/** Optional UX bundle within Area + System — see docs/v3/07-DOMAIN-MODEL.md */
export const GroupMetaSchema = z.object({
  id: z.guid(),
  areaId: z.guid(),
  systemId: SystemIdSchema,
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isEnabled: z.boolean().default(true),
});

export type GroupMeta = z.infer<typeof GroupMetaSchema>;
