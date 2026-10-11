import { z } from "zod";

export const HistoryRangeSchema = z.enum(["1h", "6h", "24h", "7d"]);
export type HistoryRange = z.infer<typeof HistoryRangeSchema>;

export const HistoryPointSchema = z.object({
  t: z.string(),
  v: z.number(),
});
export type HistoryPoint = z.infer<typeof HistoryPointSchema>;
