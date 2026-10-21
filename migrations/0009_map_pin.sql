-- The place a post's map pin marks, as map-search text ("Black Velvet Canyon,
-- Nevada, USA"). The text before the first comma labels the pin. The AI suggests
-- it from the post; admins can edit it. When it is set, place_lat, place_lon and
-- place_name come from looking it up instead of the Location.
ALTER TABLE posts ADD COLUMN map_pin TEXT NOT NULL DEFAULT '';
