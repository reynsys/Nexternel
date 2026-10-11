-- Nexternel V4 — Panel terminology (view.* → panel.*, lighting panel → controls)
-- docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < db/migrations/013_panel_terminology.sql

UPDATE systems SET default_view_kind = 'panel.controls' WHERE default_view_kind = 'view.lighting';
UPDATE systems SET default_view_kind = REPLACE(default_view_kind, 'view.', 'panel.')
WHERE default_view_kind LIKE 'view.%' AND default_view_kind <> 'view.lighting';

UPDATE systems SET default_view_kind = 'panel.controls' WHERE id = 'lighting';
