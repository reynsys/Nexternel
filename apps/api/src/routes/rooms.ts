import type { FastifyPluginAsync } from "fastify";
import { getPool, type DbRoom } from "../db.js";
import { requirePermission } from "../auth/rbac.js";

type RoomRow = DbRoom & { device_count: string };

function mapRoom(r: RoomRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
    deviceCount: Number(r.device_count) || 0,
  };
}

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/rooms", async (request, reply) => {
    if (!requirePermission(request, reply, "viewAreas")) return;

    const result = await getPool().query<RoomRow>(
      `SELECT r.id, r.name, r.description, r.sort_order,
              COUNT(d.id)::text AS device_count
       FROM rooms r
       LEFT JOIN devices d ON d.room_id = r.id
       GROUP BY r.id
       ORDER BY r.sort_order ASC, r.name ASC`
    );

    return { rooms: result.rows.map(mapRoom) };
  });

  app.post("/api/v1/rooms", async (request, reply) => {
    if (!requirePermission(request, reply, "editAreas")) return;

    const body = (request.body ?? {}) as {
      name?: unknown;
      description?: unknown;
      sortOrder?: unknown;
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "Name is required" },
      });
    }
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.trunc(body.sortOrder)
        : 0;

    try {
      const inserted = await getPool().query<DbRoom>(
        `INSERT INTO rooms (name, description, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id, name, description, sort_order`,
        [name, description, sortOrder]
      );
      const row = inserted.rows[0]!;
      return reply.code(201).send({
        room: {
          id: row.id,
          name: row.name,
          description: row.description,
          sortOrder: row.sort_order,
          deviceCount: 0,
        },
      });
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "23505") {
        return reply.code(409).send({
          error: { code: "conflict", message: "An area with that name already exists" },
        });
      }
      throw err;
    }
  });

  app.patch("/api/v1/rooms/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editAreas")) return;

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      name?: unknown;
      description?: unknown;
      sortOrder?: unknown;
    };

    const existing = await getPool().query<DbRoom>(
      `SELECT id, name, description, sort_order FROM rooms WHERE id = $1`,
      [id]
    );
    if (existing.rowCount === 0) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Area not found" },
      });
    }
    const current = existing.rows[0]!;

    let name = current.name;
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "Name cannot be empty" },
        });
      }
      name = body.name.trim();
    }

    let description = current.description;
    if (body.description !== undefined) {
      if (body.description === null) {
        description = null;
      } else if (typeof body.description === "string") {
        description = body.description.trim() || null;
      } else {
        return reply.code(400).send({
          error: { code: "validation_error", message: "Invalid description" },
        });
      }
    }

    let sortOrder = current.sort_order;
    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== "number" || !Number.isFinite(body.sortOrder)) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "Invalid sort order" },
        });
      }
      sortOrder = Math.trunc(body.sortOrder);
    }

    try {
      const updated = await getPool().query<RoomRow>(
        `UPDATE rooms
         SET name = $2,
             description = $3,
             sort_order = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, description, sort_order,
           (SELECT COUNT(*)::text FROM devices WHERE room_id = $1) AS device_count`,
        [id, name, description, sortOrder]
      );
      return { room: mapRoom(updated.rows[0]!) };
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "23505") {
        return reply.code(409).send({
          error: { code: "conflict", message: "An area with that name already exists" },
        });
      }
      throw err;
    }
  });

  app.delete("/api/v1/rooms/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editAreas")) return;

    const { id } = request.params as { id: string };
    const result = await getPool().query(`DELETE FROM rooms WHERE id = $1 RETURNING id`, [
      id,
    ]);
    if (result.rowCount === 0) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Area not found" },
      });
    }
    return { ok: true };
  });
};
