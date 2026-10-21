-- The map moves from a fixed place under the title into the post body, as a
-- { "type": "map" } block the admins can move. Existing posts with a map get the
-- block where the map already showed: after the photo or gallery that opens the
-- post, or first when the post opens with text. Empty bodies are left alone.
-- withDefaultMap in src/lib/blocks.ts does the same for new drafts.
UPDATE posts
SET body = (
	SELECT json_group_array(json(value))
	FROM (
		SELECT value, CAST(key AS REAL) AS position FROM json_each(posts.body)
		UNION ALL
		SELECT '{"type":"map"}',
			CASE WHEN json_extract(posts.body, '$[0].type') IN ('photo', 'gallery') THEN 0.5 ELSE -0.5 END
		ORDER BY position
	)
)
WHERE map_mode != 'off'
	AND json_array_length(body) > 0
	AND NOT EXISTS (SELECT 1 FROM json_each(posts.body) WHERE json_extract(value, '$.type') = 'map');
