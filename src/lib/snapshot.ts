import { z } from 'astro/zod';
import { bodySchema, referencedPhotoIds, referencedVideoIds } from './blocks';
import type { PhotoRow, PostRow, VideoRow } from './db';
import { MAP_MODES, MAP_STYLES } from './map';

// The published copy of a post. The admin page saves every edit as it is made,
// so the live site can't read the post's working columns directly: publishing
// stores a copy of everything readers see (posts.published_snapshot), and public
// pages render from that copy. Edits since then are "unpublished edits" until the
// admins publish again. Who can see a post (visibility) is not part of the copy;
// it takes effect at once. migrations/0012_published_snapshot.sql built the first
// copies with the same fields; keep the two in step.

const nullableText = z.string().nullable();

export const snapshotSchema = z.object({
	title: z.string(),
	summary: z.string(),
	body: bodySchema,
	location: z.string(),
	trip_start: nullableText,
	trip_end: nullableText,
	cover_photo_id: nullableText,
	map_mode: z.enum(MAP_MODES),
	map_style: z.enum(MAP_STYLES),
	map_pin: z.string(),
	place_lat: z.number().nullable(),
	place_lon: z.number().nullable(),
	photos: z.record(z.string(), z.object({ caption: z.string(), alt: z.string() })),
	videos: z.record(z.string(), z.object({ caption: z.string() })),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

type SnapshotPost = Pick<
	PostRow,
	'title' | 'summary' | 'body' | 'location' | 'trip_start' | 'trip_end' | 'cover_photo_id' | 'map_mode' | 'map_style' | 'map_pin' | 'place_lat' | 'place_lon'
>;

/** The copy readers would see if the post were published now. The body must already be valid. */
export function buildSnapshot(
	post: SnapshotPost,
	photos: Pick<PhotoRow, 'id' | 'caption' | 'alt'>[],
	videos: Pick<VideoRow, 'id' | 'caption'>[],
): Snapshot {
	return {
		title: post.title,
		summary: post.summary,
		body: bodySchema.parse(JSON.parse(post.body)),
		location: post.location,
		trip_start: post.trip_start,
		trip_end: post.trip_end,
		cover_photo_id: post.cover_photo_id,
		map_mode: post.map_mode,
		map_style: post.map_style,
		map_pin: post.map_pin,
		place_lat: post.place_lat,
		place_lon: post.place_lon,
		photos: Object.fromEntries(photos.map((photo) => [photo.id, { caption: photo.caption, alt: photo.alt }])),
		videos: Object.fromEntries(videos.map((video) => [video.id, { caption: video.caption }])),
	};
}

/** Reads a stored copy. Throws if a published post's copy is missing or unreadable: the page can't render without it. */
export function parseSnapshot(json: string | null): Snapshot {
	if (!json) throw new Error('This published post has no published copy');
	return snapshotSchema.parse(JSON.parse(json));
}

/** The post, photos and videos as published: the copy's text and settings over the current rows. */
export function applySnapshot<P extends SnapshotPost, Ph extends PhotoRow, V extends VideoRow>(
	snapshot: Snapshot,
	post: P,
	photos: Ph[],
	videos: V[],
): { post: P; photos: Ph[]; videos: V[] } {
	const { photos: photoText, videos: videoText, body, ...fields } = snapshot;
	return {
		post: { ...post, ...fields, body: JSON.stringify(body) },
		photos: photos.map((photo) => ({ ...photo, ...photoText[photo.id] })),
		videos: videos.map((video) => ({ ...video, ...videoText[video.id] })),
	};
}

/** Whether the post as it is now differs from its published copy. */
export function hasUnpublishedEdits(current: Snapshot, published: Snapshot): boolean {
	return JSON.stringify(canonical(current)) !== JSON.stringify(canonical(published));
}

/** The same value with object keys sorted, so key order doesn't count as a difference. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, v]) => v !== undefined)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => [k, canonical(v)]),
		);
	}
	return value;
}

/** Photo and video ids the live copy of a post shows; empty for unpublished posts. */
export function publishedMediaIds(post: Pick<PostRow, 'status' | 'published_snapshot'>): { photos: string[]; videos: string[] } {
	if (post.status !== 'published') return { photos: [], videos: [] };
	const { body } = parseSnapshot(post.published_snapshot);
	return { photos: referencedPhotoIds(body), videos: referencedVideoIds(body) };
}
