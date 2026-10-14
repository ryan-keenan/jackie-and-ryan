-- How a post's map is drawn: one of the free styles in src/lib/map.ts
-- (MAP_STYLES). Existing and new posts start with the light style.
ALTER TABLE posts ADD COLUMN map_style TEXT NOT NULL DEFAULT 'light'
  CHECK (map_style IN ('light', 'light-topo', 'old-world', 'satellite', 'satellite-topo', 'terrain-3d', 'liberty', 'fiord', 'globe'));
