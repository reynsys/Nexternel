-- CCTV cameras (RTSP → go2rtc live view)
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
