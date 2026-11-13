import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { BoardWifiInvalid, readBoardWifi, writeBoardWifi } from "../esphome/board-wifi.js";

/** "Wi-Fi for your devices": the Wi-Fi boards join. The password is never sent back to a screen. */
export async function devicesWifiRoutes(app: FastifyInstance) {
  app.get("/api/v1/devices-wifi", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    return readBoardWifi();
  });

  app.put("/api/v1/devices-wifi", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const body = (request.body ?? {}) as { ssid?: unknown; password?: unknown };
    try {
      return writeBoardWifi({
        ssid: typeof body.ssid === "string" ? body.ssid : "",
        password: typeof body.password === "string" ? body.password : "",
      });
    } catch (err) {
      if (err instanceof BoardWifiInvalid) {
        return reply.code(400).send({ error: { code: "bad_request", message: err.message } });
      }
      request.log.error({ err }, "saving Wi-Fi for devices failed");
      return reply.code(500).send({ error: { code: "save_failed", message: "The Wi-Fi couldn't be saved. Try again." } });
    }
  });
}
