import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { LineError } from "../zherodius/line.js";
import { pairZherodius, PairingRefusedError, zherodius } from "../zherodius/service.js";

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

  /**
   * Ask a Zherodius device to look for a newer version now (it also does once a day by itself) and give
   * what it found (up to 30 seconds). Nothing is installed.
   */
  app.post<{ Params: { deviceId: string } }>("/api/v1/zherodius/:deviceId/check-update", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const id = request.params.deviceId;
    try {
      let u = await zherodius.askUpdate(id, "check");
      for (let i = 0; i < 30 && u.state === "checking"; i++) {
        await new Promise((r) => setTimeout(r, 1_000));
        u = await zherodius.askUpdate(id);
      }
      if (u.state === "checking") {
        return reply.code(409).send({ error: { code: "not_possible", message: "The device has not finished looking yet. Look again in a minute." } });
      }
      if (u.state === "failed") return reply.code(409).send({ error: { code: "not_possible", message: `The device could not look for an update: ${u.message || "no reason given"}` } });
      return { ok: true, latest: u.latest || null, version: u.version };
    } catch (err) {
      if (err instanceof LineError) return reply.code(409).send({ error: { code: "not_possible", message: err.message } });
      throw err;
    }
  });
}
