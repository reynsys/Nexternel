-- Nexternel - PostgreSQL Schema (package version: see VERSION at repo root)
-- Admin metadata: rooms, devices, sensors, relays, automations, users

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Rooms
CREATE TABLE rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ESP32 / ESPHome devices
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    esphome_name    VARCHAR(100),
    mqtt_topic_prefix VARCHAR(200) NOT NULL,
    ip_address      INET,
    mac_address     VARCHAR(17),
    firmware_type   VARCHAR(50) NOT NULL DEFAULT 'esphome',
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    is_online       BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CCTV cameras (RTSP → go2rtc live view)
CREATE TABLE cameras (
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

CREATE INDEX idx_cameras_area ON cameras(area_id);
CREATE INDEX idx_cameras_sort ON cameras(sort_order, name);

-- Sensors attached to devices (DHT11 temp/humidity, etc.)
CREATE TABLE sensors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    sensor_type     VARCHAR(50) NOT NULL,
    unit            VARCHAR(20),
    mqtt_state_topic VARCHAR(300) NOT NULL,
    esphome_entity_id VARCHAR(100),
    gpio_pin        INT,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, slug)
);

-- Relays / switches
CREATE TABLE relays (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(100) NOT NULL,
    mqtt_command_topic  VARCHAR(300) NOT NULL,
    mqtt_state_topic    VARCHAR(300) NOT NULL,
    esphome_entity_id   VARCHAR(100),
    gpio_pin            INT,
    is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    last_state          VARCHAR(10),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, slug)
);

-- Automation rules (evaluated by Node-RED or future worker; stored here for admin UI)
CREATE TABLE automations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_config  JSONB NOT NULL DEFAULT '{}',
    action_type     VARCHAR(50) NOT NULL,
    action_config   JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin users
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    role            VARCHAR(20) NOT NULL DEFAULT 'admin',
    theme_prefs     JSONB NOT NULL DEFAULT '{}'::jsonb,
    avatar_data     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_devices_room ON devices(room_id);
CREATE INDEX idx_sensors_device ON sensors(device_id);
CREATE INDEX idx_relays_device ON relays(device_id);
CREATE INDEX idx_automations_enabled ON automations(is_enabled);

-- Roles (Administrator / Viewer + custom)
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(50) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (slug, name, description, is_admin, is_system, sort_order)
VALUES
  ('admin', 'Administrator', 'Full access — manage users, roles, devices, and settings', TRUE, TRUE, 0),
  ('viewer', 'Viewer', 'Signed-in access without admin privileges', FALSE, TRUE, 10)
ON CONFLICT (slug) DO NOTHING;

-- Default room
INSERT INTO rooms (name, description, sort_order) VALUES
    ('Living Room', 'Main living area', 1),
    ('Bedroom', 'Master bedroom', 2),
    ('Garage', 'Garage and workshop', 3);
