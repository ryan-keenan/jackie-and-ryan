-- Per-post map shown under the post title, built from photo GPS positions.
-- 'off' hides it; the others set how far out the map is zoomed.
-- Existing posts start with no map; new posts default to country level.
ALTER TABLE posts ADD COLUMN map_mode TEXT NOT NULL DEFAULT 'off'
  CHECK (map_mode IN ('off', 'fit', 'city', 'region', 'country', 'world'));
