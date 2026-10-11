import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../auth/plugin.js";
import { isHistoryRange, type HistoryRange } from "../history/influx.js";
import { queryCapabilityHistory } from "../history/query.js";

const HISTORY_RATE_LIMIT = {
  max: 120,
  timeWindow: "1 minute",
} as const;

const MAX_BATCH_IDS = 24;

function parseCapabilityIds(query: {
  capabilityId?: string;
  capabilityIds?: string;
}): string[] {
  const raw =
    query.capabilityIds?.trim() ||
    query.capabilityId?.trim() ||
    "";
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

export const historyRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { capabilityId?: string; capabilityIds?: string; range?: string };
  }>(
    "/api/v1/history",
    {
      config: {
        rateLimit: HISTORY_RATE_LIMIT,
      },
    },
    async (request, reply) => {
      if (!requireUser(request, reply)) return;

      const capabilityIds = parseCapabilityIds(request.query);
      if (capabilityIds.length === 0) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "capabilityId or capabilityIds is required",
          },
        });
      }

      if (capabilityIds.length > MAX_BATCH_IDS) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: `At most ${MAX_BATCH_IDS} capabilityIds per request`,
          },
        });
      }

      const rangeRaw = (request.query.range ?? "24h").trim();
      if (!isHistoryRange(rangeRaw)) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "range must be one of: 1h, 6h, 24h, 7d",
          },
        });
      }
      const range: HistoryRange = rangeRaw;
      const batchMode = Boolean(request.query.capabilityIds?.trim());

      if (capabilityIds.length === 1 && !batchMode) {
        const series = await queryCapabilityHistory(capabilityIds[0]!, range);
        if (series.error && series.points.length === 0) {
          const isNotFound = series.error === "Capability not found";
          return reply.code(isNotFound ? 404 : 502).send({
            error: {
              code: isNotFound ? "not_found" : "influx_error",
              message: series.error,
            },
          });
        }
        return {
          capabilityId: series.capabilityId,
          name: series.name,
          unit: series.unit,
          range,
          aggregateEvery: series.aggregateEvery,
          points: series.points,
        };
      }

      const series = await Promise.all(
        capabilityIds.map((id) => queryCapabilityHistory(id, range))
      );
      return { range, series };
    }
  );
};
