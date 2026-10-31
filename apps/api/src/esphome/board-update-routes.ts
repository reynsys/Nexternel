import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { boardUpdateHistory, listBoardStatus, startBoardUpdates, updateLog, updateRun } from "./board-updates.js";
import { linkDeviceYamlFile } from "./builder/firmware.js";

export const boardUpdateRoutes: FastifyPluginAsync = async (app) => {
  /** Every ESPHome board: does it need an update, can it be reached; and the update in progress. */
  app.get("/api/v1/esphome/boards", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    return { boards: await listBoardStatus(), run: updateRun() };
  });

  app.get("/api/v1/esphome/updates", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    return { run: updateRun() };
  });

  /** One kept update record: the outcome and everything ESPHome wrote. */
  app.get<{ Params: { id: string } }>("/api/v1/esphome/updates/log/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const entry = await updateLog(request.params.id);
    if (!entry) return reply.code(404).send({ error: { code: "not_found", message: "This update record is no longer kept." } });
    return { entry };
  });

  /** A board's kept updates, newest first. */
  app.get<{ Params: { deviceId: string } }>("/api/v1/esphome/boards/:deviceId/updates", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    if (!/^[0-9a-f-]{36}$/i.test(request.params.deviceId)) return { updates: [] };
    return { updates: await boardUpdateHistory(request.params.deviceId) };
  });

  /** Update these boards over Wi-Fi, one after another, in the background. */
  app.post<{ Body: { deviceIds?: string[] } }>("/api/v1/esphome/updates", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const wanted = new Set((request.body?.deviceIds ?? []).filter((id) => typeof id === "string"));
    const boards = (await listBoardStatus()).filter((b) => wanted.has(b.deviceId));
    if (!boards.length) return reply.code(400).send({ error: { code: "bad_request", message: "Choose at least one ESPHome board." } });
    try {
      return { run: startBoardUpdates(boards) };
    } catch (err) {
      return reply.code(409).send({ error: { code: "busy", message: err instanceof Error ? err.message : "Busy" } });
    }
  });

  /** Link a board to its settings file (only a file with the board's own message address). */
  app.post<{ Body: { deviceId?: string; file?: string } }>("/api/v1/esphome/link", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { deviceId, file } = request.body ?? {};
    if (!deviceId || !file) return reply.code(400).send({ error: { code: "bad_request", message: "Choose a board and a file." } });
    try {
      await linkDeviceYamlFile(deviceId, file);
      return { ok: true };
    } catch (err) {
      return reply.code(400).send({ error: { code: "not_linked", message: err instanceof Error ? err.message : "Could not link" } });
    }
  });
};
