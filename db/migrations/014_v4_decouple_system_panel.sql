-- V4 Phase 7: decouple Systems from Panels — remove default_view_kind column.

ALTER TABLE systems DROP COLUMN IF EXISTS default_view_kind;
