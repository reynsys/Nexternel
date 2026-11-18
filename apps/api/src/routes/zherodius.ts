import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { pairZherodius, PairingRefusedError } from "../zherodius/service.js";

export async function zherodiusRoutes(app: FastifyInstance) {
  /** Pair a Zherodius device with the code shown on its page; it becomes a device in Nexternel. */
  app.post<{ Body: { address?: unknown; code?: unknown; roomId?: unknown } }>("/api/v1/zherodius/pair", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { address, code, roomId } = request.body ?? {};
    if (typeof address !== "string" || typeof code !== "string") {
      return reply.code(400).send({ error: { code: "validation_error", message: "The device's address and its pairing code are needed." } });
    }
    try {
      return { ok: true, ...(await pairZherodius({ address, code, roomId: typeof roomId === "string" && roomId ? roomId : null })) };
    } catch (err) {
      if (err instanceof PairingRefusedError) return reply.code(400).send({ error: { code: "pairing_refused", message: err.message } });
      throw err;
    }
  });
}
