import { getPool } from "../db.js";
import { parseRtspUrl, composeRtspUrl } from "./connection.js";

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS cameras (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    stream_id   VARCHAR(80) NOT NULL UNIQUE,
    rtsp_url    TEXT NOT NULL,
    area_id     UUID REFERENCES rooms(id) ON DELETE SET NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cameras_area ON cameras(area_id);
CREATE INDEX IF NOT EXISTS idx_cameras_sort ON cameras(sort_order, name);

ALTER TABLE cameras ADD COLUMN IF NOT EXISTS rtsp_host TEXT;
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS rtsp_port INTEGER NOT NULL DEFAULT 554;
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS rtsp_path TEXT;
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS rtsp_username TEXT;
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS rtsp_password TEXT;
`;

/** Split legacy rtsp_url rows into host/path/user/pass (idempotent). */
async function migrateLegacyRtspUrls(): Promise<void> {
  const result = await getPool().query<{
    id: string;
    rtsp_url: string;
    rtsp_host: string | null;
  }>(
    `SELECT id, rtsp_url, rtsp_host FROM cameras
     WHERE rtsp_host IS NULL OR btrim(rtsp_host) = ''`
  );

  for (const row of result.rows) {
    const parsed = parseRtspUrl(row.rtsp_url);
    if (!parsed) continue;
    const composed = composeRtspUrl(parsed);
    await getPool().query(
      `UPDATE cameras SET
         rtsp_host = $2,
         rtsp_port = $3,
         rtsp_path = $4,
         rtsp_username = $5,
         rtsp_password = $6,
         rtsp_url = $7,
         updated_at = NOW()
       WHERE id = $1`,
      [
        row.id,
        parsed.host,
        parsed.port,
        parsed.path,
        parsed.username,
        parsed.password,
        composed,
      ]
    );
  }
}

export async function ensureCameraSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
  await migrateLegacyRtspUrls();
}
