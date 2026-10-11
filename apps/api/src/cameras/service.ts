import { getPool } from "../db.js";
import {
  composeRtspUrl,
  parseRtspUrl,
  rtspConnectionPreview,
  type RtspConnection,
} from "./connection.js";
import {
  go2rtcDeleteStream,
  go2rtcPutStream,
  go2rtcWarmupStream,
  go2rtcStreamHasProducer,
  playUrlsForStream,
} from "./go2rtc.js";
import { normalizeStreamId } from "./presets.js";

export type CameraRow = {
  id: string;
  name: string;
  stream_id: string;
  rtsp_url: string;
  rtsp_host: string | null;
  rtsp_port: number;
  rtsp_path: string | null;
  rtsp_username: string | null;
  rtsp_password: string | null;
  area_id: string | null;
  area_name: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type CameraPublic = {
  id: string;
  name: string;
  streamId: string;
  areaId: string | null;
  areaName: string | null;
  enabled: boolean;
  sortOrder: number;
  hasRtspUrl: boolean;
  /** Editors only — never includes the password. */
  host?: string;
  port?: number;
  path?: string;
  username?: string;
  hasPassword?: boolean;
  /** Safe preview e.g. rtsp://admin:***@192.168.1.50:554/ch01/1 */
  connectionPreview?: string;
};

function connectionFromRow(r: CameraRow): RtspConnection {
  if (r.rtsp_host?.trim()) {
    return {
      host: r.rtsp_host.trim(),
      port: r.rtsp_port || 554,
      path: (r.rtsp_path || "/").trim() || "/",
      username: r.rtsp_username ?? "",
      password: r.rtsp_password ?? "",
    };
  }
  const parsed = parseRtspUrl(r.rtsp_url);
  if (parsed) return parsed;
  return {
    host: "",
    port: 554,
    path: "/",
    username: "",
    password: "",
  };
}

function mapPublic(r: CameraRow, includeConnection = false): CameraPublic {
  const conn = connectionFromRow(r);
  const hasPassword = Boolean(conn.password);
  const base: CameraPublic = {
    id: r.id,
    name: r.name,
    streamId: r.stream_id,
    areaId: r.area_id,
    areaName: r.area_name,
    enabled: r.enabled,
    sortOrder: r.sort_order,
    hasRtspUrl: Boolean(r.rtsp_url?.trim() || conn.host),
  };
  if (!includeConnection) return base;
  return {
    ...base,
    host: conn.host,
    port: conn.port,
    path: conn.path,
    username: conn.username,
    hasPassword,
    connectionPreview: rtspConnectionPreview({
      host: conn.host,
      port: conn.port,
      path: conn.path,
      username: conn.username,
      hasPassword,
    }),
  };
}

const SELECT_SQL = `
  SELECT c.id, c.name, c.stream_id, c.rtsp_url,
         c.rtsp_host, c.rtsp_port, c.rtsp_path, c.rtsp_username, c.rtsp_password,
         c.area_id, c.enabled, c.sort_order,
         c.created_at, c.updated_at,
         r.name AS area_name
  FROM cameras c
  LEFT JOIN rooms r ON r.id = c.area_id
`;

export async function listCameras(
  includeConnection = false
): Promise<CameraPublic[]> {
  const result = await getPool().query<CameraRow>(
    `${SELECT_SQL} ORDER BY c.sort_order ASC, c.name ASC`
  );
  return result.rows.map((r) => mapPublic(r, includeConnection));
}

export async function getCamera(
  id: string,
  includeConnection = false
): Promise<CameraPublic | null> {
  const result = await getPool().query<CameraRow>(
    `${SELECT_SQL} WHERE c.id = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? mapPublic(row, includeConnection) : null;
}

async function getCameraRow(id: string): Promise<CameraRow | null> {
  const result = await getPool().query<CameraRow>(
    `${SELECT_SQL} WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

function resolveConnection(input: {
  host?: string;
  port?: number;
  path?: string;
  username?: string;
  password?: string;
  /** Legacy: full URL — parsed into parts when host not provided. */
  rtspUrl?: string;
}): RtspConnection {
  if (input.host?.trim()) {
    return {
      host: input.host.trim(),
      port:
        typeof input.port === "number" && Number.isFinite(input.port) && input.port > 0
          ? Math.trunc(input.port)
          : 554,
      path: (input.path || "/").trim() || "/",
      username: (input.username ?? "").trim(),
      password: input.password ?? "",
    };
  }
  if (input.rtspUrl?.trim()) {
    const parsed = parseRtspUrl(input.rtspUrl);
    if (parsed) return parsed;
  }
  throw Object.assign(
    new Error("Camera host (or a full RTSP URL) is required"),
    { code: "validation" }
  );
}

export type CreateCameraInput = {
  name: string;
  streamId: string;
  host?: string;
  port?: number;
  path?: string;
  username?: string;
  password?: string;
  /** Legacy adopt / old clients */
  rtspUrl?: string;
  areaId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export async function createCamera(
  input: CreateCameraInput
): Promise<CameraPublic> {
  const streamId = normalizeStreamId(input.streamId);
  if (!streamId) {
    throw Object.assign(new Error("streamId is required"), { code: "validation" });
  }
  const name = input.name.trim();
  if (!name) {
    throw Object.assign(new Error("name is required"), { code: "validation" });
  }

  const conn = resolveConnection(input);
  const rtspUrl = composeRtspUrl(conn);

  const inserted = await getPool().query<{ id: string }>(
    `INSERT INTO cameras (
       name, stream_id, rtsp_url,
       rtsp_host, rtsp_port, rtsp_path, rtsp_username, rtsp_password,
       area_id, enabled, sort_order
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
     )
     RETURNING id`,
    [
      name,
      streamId,
      rtspUrl,
      conn.host,
      conn.port,
      conn.path,
      conn.username,
      conn.password,
      input.areaId ?? null,
      input.enabled !== false,
      input.sortOrder ?? 0,
    ]
  );
  const id = inserted.rows[0]!.id;

  try {
    if (input.enabled !== false) {
      await go2rtcPutStream(streamId, rtspUrl);
    }
  } catch (err) {
    await getPool().query(`DELETE FROM cameras WHERE id = $1`, [id]);
    throw err;
  }

  const cam = await getCamera(id, true);
  return cam!;
}

export type UpdateCameraInput = {
  name?: string;
  streamId?: string;
  host?: string;
  port?: number;
  path?: string;
  username?: string;
  /** Omit / undefined = keep existing; empty string clears; non-empty replaces. */
  password?: string;
  rtspUrl?: string;
  areaId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export async function updateCamera(
  id: string,
  input: UpdateCameraInput
): Promise<CameraPublic | null> {
  const existing = await getCameraRow(id);
  if (!existing) return null;

  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : existing.name;
  const nextStreamId =
    typeof input.streamId === "string" && input.streamId.trim()
      ? normalizeStreamId(input.streamId)
      : existing.stream_id;
  if (!nextStreamId) {
    throw Object.assign(new Error("streamId is required"), { code: "validation" });
  }

  const prev = connectionFromRow(existing);
  let conn: RtspConnection;

  if (input.host !== undefined || input.path !== undefined || input.rtspUrl?.trim()) {
    if (input.rtspUrl?.trim() && !input.host?.trim()) {
      conn = resolveConnection({ rtspUrl: input.rtspUrl });
      if (input.password === undefined) {
        // Keep previous password if paste had none / empty after parse
        if (!conn.password && prev.password) conn.password = prev.password;
      } else {
        conn.password = input.password;
      }
      if (input.username !== undefined) conn.username = input.username.trim();
      if (input.port !== undefined && Number.isFinite(input.port)) {
        conn.port = Math.trunc(input.port);
      }
    } else {
      conn = {
        host: (input.host ?? prev.host).trim(),
        port:
          typeof input.port === "number" && Number.isFinite(input.port) && input.port > 0
            ? Math.trunc(input.port)
            : prev.port || 554,
        path: ((input.path ?? prev.path) || "/").trim() || "/",
        username:
          input.username !== undefined
            ? input.username.trim()
            : prev.username,
        password:
          input.password !== undefined ? input.password : prev.password,
      };
    }
  } else {
    conn = {
      ...prev,
      username:
        input.username !== undefined ? input.username.trim() : prev.username,
      password:
        input.password !== undefined ? input.password : prev.password,
      port:
        typeof input.port === "number" && Number.isFinite(input.port) && input.port > 0
          ? Math.trunc(input.port)
          : prev.port || 554,
    };
  }

  if (!conn.host.trim()) {
    throw Object.assign(new Error("Camera host is required"), {
      code: "validation",
    });
  }

  const rtspUrl = composeRtspUrl(conn);
  const areaId =
    input.areaId === undefined ? existing.area_id : input.areaId;
  const enabled =
    typeof input.enabled === "boolean" ? input.enabled : existing.enabled;
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.trunc(input.sortOrder)
      : existing.sort_order;

  await getPool().query(
    `UPDATE cameras
     SET name = $2, stream_id = $3, rtsp_url = $4,
         rtsp_host = $5, rtsp_port = $6, rtsp_path = $7,
         rtsp_username = $8, rtsp_password = $9,
         area_id = $10, enabled = $11, sort_order = $12, updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      name,
      nextStreamId,
      rtspUrl,
      conn.host,
      conn.port,
      conn.path,
      conn.username,
      conn.password,
      areaId,
      enabled,
      sortOrder,
    ]
  );

  if (existing.stream_id !== nextStreamId) {
    try {
      await go2rtcDeleteStream(existing.stream_id);
    } catch {
      /* ignore */
    }
  }

  if (enabled) {
    await go2rtcPutStream(nextStreamId, rtspUrl);
  } else {
    await go2rtcDeleteStream(nextStreamId);
  }

  return getCamera(id, true);
}

export async function deleteCamera(id: string): Promise<boolean> {
  const existing = await getCameraRow(id);
  if (!existing) return false;
  await getPool().query(`DELETE FROM cameras WHERE id = $1`, [id]);
  try {
    await go2rtcDeleteStream(existing.stream_id);
  } catch {
    /* ignore */
  }
  return true;
}

export async function getCameraPlay(id: string): Promise<{
  id: string;
  name: string;
  streamId: string;
  hlsUrl: string;
  mseUrl: string;
  enabled: boolean;
  warmedUp: boolean;
} | null> {
  const row = await getCameraRow(id);
  if (!row) return null;
  if (!row.enabled) {
    const urls = playUrlsForStream(row.stream_id);
    return {
      id: row.id,
      name: row.name,
      enabled: false,
      warmedUp: false,
      ...urls,
    };
  }

  // Register only if go2rtc does not already have a live producer — re-PUT on
  // every play was tearing down RTSP and causing blank multi-camera tiles.
  try {
    const conn = connectionFromRow(row);
    if (conn.host) {
      const live = await go2rtcStreamHasProducer(row.stream_id);
      if (!live) {
        await go2rtcPutStream(row.stream_id, composeRtspUrl(conn));
      }
    }
  } catch {
    /* still try warmup / play */
  }
  const warmedUp = await go2rtcWarmupStream(row.stream_id);
  const urls = playUrlsForStream(row.stream_id);
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    warmedUp,
    ...urls,
  };
}

/** Re-push all enabled cameras to go2rtc (startup / recovery). */
export async function syncAllCamerasToGo2rtc(): Promise<{
  synced: number;
  errors: string[];
}> {
  const result = await getPool().query<CameraRow>(
    `${SELECT_SQL} WHERE c.enabled = TRUE`
  );
  let synced = 0;
  const errors: string[] = [];
  for (const row of result.rows) {
    try {
      const conn = connectionFromRow(row);
      if (!conn.host) {
        errors.push(`${row.name}: missing host`);
        continue;
      }
      const rtspUrl = composeRtspUrl(conn);
      if (
        rtspUrl !== row.rtsp_url ||
        !row.rtsp_host ||
        row.rtsp_host !== conn.host
      ) {
        await getPool().query(
          `UPDATE cameras SET
             rtsp_url = $2, rtsp_host = $3, rtsp_port = $4, rtsp_path = $5,
             rtsp_username = $6, rtsp_password = $7, updated_at = NOW()
           WHERE id = $1`,
          [
            row.id,
            rtspUrl,
            conn.host,
            conn.port,
            conn.path,
            conn.username,
            conn.password,
          ]
        );
      }
      await go2rtcPutStream(row.stream_id, rtspUrl);
      synced += 1;
    } catch (err) {
      errors.push(
        `${row.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return { synced, errors };
}
