import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { VIEWER_PERMISSIONS } from "../auth/permissions.js";
import { CAMERA_BRAND_PRESETS } from "../cameras/presets.js";
import {
  createCamera,
  deleteCamera,
  getCamera,
  getCameraPlay,
  listCameras,
  updateCamera,
} from "../cameras/service.js";

function pgErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "";
}

/** Editors get host/path/username (never the raw password). */
function canSeeConnection(request: FastifyRequest): boolean {
  const u = request.user;
  if (!u) return false;
  if (u.isAdmin || u.role === "admin") return true;
  const fromToken = u.permissions?.editDevices;
  return typeof fromToken === "boolean"
    ? fromToken
    : VIEWER_PERMISSIONS.editDevices;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return undefined;
}

export const camerasRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/cameras/presets", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    return { presets: CAMERA_BRAND_PRESETS };
  });

  app.get("/api/v1/cameras", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const cameras = await listCameras(canSeeConnection(request));
    return { cameras };
  });

  app.get("/api/v1/cameras/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const { id } = request.params as { id: string };
    const camera = await getCamera(id, canSeeConnection(request));
    if (!camera) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Camera not found" },
      });
    }
    return { camera };
  });

  app.get("/api/v1/cameras/:id/play", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const { id } = request.params as { id: string };
    const play = await getCameraPlay(id);
    if (!play) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Camera not found" },
      });
    }
    if (!play.enabled) {
      return reply.code(503).send({
        error: { code: "disabled", message: "Camera is disabled" },
      });
    }
    return { play };
  });

  app.post("/api/v1/cameras", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const camera = await createCamera({
        name: str(body.name) ?? "",
        streamId: str(body.streamId) ?? "",
        host: str(body.host),
        port: num(body.port),
        path: str(body.path),
        username: str(body.username),
        password: str(body.password),
        rtspUrl: str(body.rtspUrl),
        areaId:
          typeof body.areaId === "string" && body.areaId.trim()
            ? body.areaId.trim()
            : null,
        enabled: body.enabled !== false,
        sortOrder: num(body.sortOrder),
      });
      return reply.code(201).send({ camera });
    } catch (err: unknown) {
      const code = pgErrorCode(err);
      if (code === "23505") {
        return reply.code(409).send({
          error: {
            code: "conflict",
            message: "A camera with that stream id already exists",
          },
        });
      }
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: unknown }).code === "validation"
      ) {
        return reply.code(400).send({
          error: {
            code: "validation_error",
            message: err instanceof Error ? err.message : "Invalid camera",
          },
        });
      }
      const msg = err instanceof Error ? err.message : "Create failed";
      if (msg.includes("go2rtc")) {
        return reply.code(502).send({
          error: { code: "go2rtc_error", message: msg },
        });
      }
      throw err;
    }
  });

  app.patch("/api/v1/cameras/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    try {
      const camera = await updateCamera(id, {
        name: str(body.name),
        streamId: str(body.streamId),
        host: str(body.host),
        port: num(body.port),
        path: str(body.path),
        username: str(body.username),
        password:
          body.password === undefined
            ? undefined
            : typeof body.password === "string"
              ? body.password
              : undefined,
        rtspUrl: str(body.rtspUrl),
        areaId:
          body.areaId === null
            ? null
            : typeof body.areaId === "string"
              ? body.areaId.trim() || null
              : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        sortOrder: num(body.sortOrder),
      });
      if (!camera) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Camera not found" },
        });
      }
      return { camera };
    } catch (err: unknown) {
      const code = pgErrorCode(err);
      if (code === "23505") {
        return reply.code(409).send({
          error: {
            code: "conflict",
            message: "A camera with that stream id already exists",
          },
        });
      }
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: unknown }).code === "validation"
      ) {
        return reply.code(400).send({
          error: {
            code: "validation_error",
            message: err instanceof Error ? err.message : "Invalid camera",
          },
        });
      }
      const msg = err instanceof Error ? err.message : "Update failed";
      if (msg.includes("go2rtc")) {
        return reply.code(502).send({
          error: { code: "go2rtc_error", message: msg },
        });
      }
      throw err;
    }
  });

  app.delete("/api/v1/cameras/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { id } = request.params as { id: string };
    const ok = await deleteCamera(id);
    if (!ok) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Camera not found" },
      });
    }
    return reply.code(204).send();
  });
};
