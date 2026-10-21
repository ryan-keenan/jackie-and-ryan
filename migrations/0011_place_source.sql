-- The web page the map pin's coordinates came from, when "Find the place" took
-- them from a web search (src/lib/ai/place.ts); empty when the pin came from an
-- OpenStreetMap lookup. Shown to the admins so they can check the pin.
ALTER TABLE posts ADD COLUMN place_source TEXT NOT NULL DEFAULT '';

-- map_pin now holds just the pin's label ("Black Velvet Peak"). It used to hold
-- map search text whose label was the part before the first comma
-- ("Black Velvet Canyon, Nevada, USA"); keep only that part.
UPDATE posts SET map_pin = trim(substr(map_pin, 1, instr(map_pin, ',') - 1)) WHERE instr(map_pin, ',') > 0;
