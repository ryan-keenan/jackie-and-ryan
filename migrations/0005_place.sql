-- Where the post's Location text points on the map, looked up when the Location
-- is saved. The map uses it when no photo has a GPS position (phones often strip
-- location when sharing photos). place_name is the matched place, shown to the
-- admins so a wrong match (there are many Eagle Lakes) is easy to spot.
ALTER TABLE posts ADD COLUMN place_lat REAL;
ALTER TABLE posts ADD COLUMN place_lon REAL;
ALTER TABLE posts ADD COLUMN place_name TEXT NOT NULL DEFAULT '';
