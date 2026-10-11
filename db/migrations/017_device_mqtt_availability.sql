-- Device MQTT availability (explicit online/offline from birth/LWT topics).
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS mqtt_availability VARCHAR(16) NOT NULL DEFAULT 'unknown';
