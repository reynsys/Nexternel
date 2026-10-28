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
    icon: r.icon,
    deviceCount: Number(r.device_count) || 0,
  };
}

const ICON_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** An icon id from the request, null to clear, undefined when not given (or not valid). */
function iconField(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  return typeof v === "string" && ICON_ID.test(v) ? v : undefined;
}

export const roomsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/rooms", async (request, reply) => {
    if (!requirePermission(request, reply, "viewAreas")) return;

    const result = await getPool().query<RoomRow>(
      `SELECT r.id, r.name, r.description, r.sort_order, r.icon,
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
      icon?: unknown;
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
        : (await getPool().query<{ n: number }>(`SELECT COALESCE(MAX(sort_order) + 1, 0)::int AS n FROM rooms`)).rows[0]!.n;

    try {
      const inserted = await getPool().query<DbRoom>(
        `INSERT INTO rooms (name, description, sort_order, icon)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, sort_order, icon`,
        [name, description, sortOrder, iconField(body.icon) ?? null]
      );
      const row = inserted.rows[0]!;
      return reply.code(201).send({
        room: {
          id: row.id,
          name: row.name,
          description: row.description,
          sortOrder: row.sort_order,
          icon: row.icon,
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
      icon?: unknown;
    };

    const existing = await getPool().query<DbRoom>(
      `SELECT id, name, description, sort_order, icon FROM rooms WHERE id = $1`,
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

    const iconIn = iconField(body.icon);
    const icon = iconIn === undefined ? current.icon : iconIn;

    try {
      const updated = await getPool().query<RoomRow>(
        `UPDATE rooms
         SET name = $2,
             description = $3,
             sort_order = $4,
             icon = $5,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, description, sort_order, icon,
           (SELECT COUNT(*)::text FROM devices WHERE room_id = $1) AS device_count`,
        [id, name, description, sortOrder, icon]
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

  /** The order of the areas (first = top), as on the Areas page. */
  app.post("/api/v1/rooms/reorder", async (request, reply) => {
    if (!requirePermission(request, reply, "editAreas")) return;
    const body = (request.body ?? {}) as { orderedIds?: unknown };
    const ids = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x): x is string => typeof x === "string") : [];
    if (!ids.length) {
      return reply.code(400).send({ error: { code: "validation_error", message: "orderedIds is required" } });
    }
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (const [i, id] of ids.entries()) {
        await client.query(`UPDATE rooms SET sort_order = $2, updated_at = NOW() WHERE id = $1::uuid`, [id, i]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return { ok: true };
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
