-- Optional user avatar (data URL, resized client-side)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_data TEXT NULL;
