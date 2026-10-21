-- The published copy of each post: everything readers see, stored when the post
-- is published, so edits (which now save as they're typed) reach the live site
-- only when the admins publish again. See src/lib/snapshot.ts, whose
-- buildSnapshot makes the same JSON; keep the two in step. Already-published
-- posts get a copy of how they are now.
ALTER TABLE posts ADD COLUMN published_snapshot TEXT;

UPDATE posts
SET published_snapshot = json_object(
	'title', title,
	'summary', summary,
	'body', json(body),
	'location', location,
	'trip_start', trip_start,
	'trip_end', trip_end,
	'cover_photo_id', cover_photo_id,
	'map_mode', map_mode,
	'map_style', map_style,
	'map_pin', map_pin,
	'place_lat', place_lat,
	'place_lon', place_lon,
	'photos', (SELECT json_group_object(id, json_object('caption', caption, 'alt', alt)) FROM photos WHERE photos.post_id = posts.id),
	'videos', (SELECT json_group_object(id, json_object('caption', caption)) FROM videos WHERE videos.post_id = posts.id)
)
WHERE status = 'published';
