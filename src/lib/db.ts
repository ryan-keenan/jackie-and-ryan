import { env } from 'cloudflare:workers';

export interface PostRow {
	id: string;
	slug: string;
	title: string;
	summary: string;
	status: 'draft' | 'published';
	visibility: 'public' | 'private';
	trip_start: string | null;
	trip_end: string | null;
	location: string;
	cover_photo_id: string | null;
	body: string;
	published_at: string | null;
}

export interface PhotoRow {
	id: string;
	post_id: string;
	r2_key_display: string;
	r2_key_thumb: string;
	width: number;
	height: number;
	taken_at: string | null;
	caption: string;
	alt: string;
	sort_order: number;
}

/** A post card on the homepage, with its cover thumbnail key if it has a cover. */
export type PostListItem = Pick<
	PostRow,
	'id' | 'slug' | 'title' | 'summary' | 'trip_start' | 'trip_end' | 'location' | 'published_at'
> & { cover_thumb_key: string | null; cover_alt: string | null };

const POST_COLUMNS =
	'id, slug, title, summary, status, visibility, trip_start, trip_end, location, cover_photo_id, body, published_at';

export async function listPublishedPosts(visibility: PostRow['visibility']): Promise<PostListItem[]> {
	const { results } = await env.DB.prepare(
		`SELECT p.id, p.slug, p.title, p.summary, p.trip_start, p.trip_end, p.location, p.published_at,
		        c.r2_key_thumb AS cover_thumb_key, c.alt AS cover_alt
		   FROM posts p
		   LEFT JOIN photos c ON c.id = p.cover_photo_id AND c.post_id = p.id
		  WHERE p.status = 'published' AND p.visibility = ?
		  ORDER BY p.published_at DESC`,
	)
		.bind(visibility)
		.all<PostListItem>();
	return results;
}

export async function getPublishedPost(slug: string, visibility: PostRow['visibility']): Promise<PostRow | null> {
	return env.DB.prepare(
		`SELECT ${POST_COLUMNS} FROM posts WHERE slug = ? AND status = 'published' AND visibility = ?`,
	)
		.bind(slug, visibility)
		.first<PostRow>();
}

export async function getPhotosForPost(postId: string): Promise<PhotoRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, post_id, r2_key_display, r2_key_thumb, width, height, taken_at, caption, alt, sort_order
		   FROM photos WHERE post_id = ? ORDER BY sort_order, taken_at`,
	)
		.bind(postId)
		.all<PhotoRow>();
	return results;
}

/**
 * Finds which post visibility a stored image belongs to, but only if that post is
 * published. Returns null for unknown keys, drafts, and originals (only display
 * and thumbnail sizes are ever served).
 */
export async function getServableImageVisibility(r2Key: string): Promise<PostRow['visibility'] | null> {
	const row = await env.DB.prepare(
		`SELECT p.visibility
		   FROM photos ph JOIN posts p ON p.id = ph.post_id
		  WHERE (ph.r2_key_display = ?1 OR ph.r2_key_thumb = ?1) AND p.status = 'published'`,
	)
		.bind(r2Key)
		.first<{ visibility: PostRow['visibility'] }>();
	return row?.visibility ?? null;
}

// ---------------------------------------------------------------------------
// Admin queries. These see drafts and private posts; only call them from
// /admin and /api/admin routes, which src/middleware.ts protects.

export interface AdminPostListItem {
	id: string;
	slug: string;
	title: string;
	status: PostRow['status'];
	visibility: PostRow['visibility'];
	updated_at: string;
	photo_count: number;
}

export interface AdminPost extends PostRow {
	author_notes: string;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface AdminPhoto extends PhotoRow {
	r2_key_original: string;
	lat: number | null;
	lon: number | null;
	note: string;
}

export async function listAllPosts(): Promise<AdminPostListItem[]> {
	const { results } = await env.DB.prepare(
		`SELECT p.id, p.slug, p.title, p.status, p.visibility, p.updated_at,
		        (SELECT COUNT(*) FROM photos ph WHERE ph.post_id = p.id) AS photo_count
		   FROM posts p ORDER BY p.updated_at DESC`,
	).all<AdminPostListItem>();
	return results;
}

export async function getPostForAdmin(id: string): Promise<AdminPost | null> {
	return env.DB.prepare(
		`SELECT ${POST_COLUMNS}, author_notes, created_by, created_at, updated_at FROM posts WHERE id = ?`,
	)
		.bind(id)
		.first<AdminPost>();
}

export async function getPhotosForAdmin(postId: string): Promise<AdminPhoto[]> {
	const { results } = await env.DB.prepare(
		`SELECT id, post_id, r2_key_original, r2_key_display, r2_key_thumb, width, height, taken_at,
		        lat, lon, caption, alt, note, sort_order
		   FROM photos WHERE post_id = ? ORDER BY sort_order, taken_at`,
	)
		.bind(postId)
		.all<AdminPhoto>();
	return results;
}

export async function getPhotoForAdmin(id: string): Promise<AdminPhoto | null> {
	return env.DB.prepare(
		`SELECT id, post_id, r2_key_original, r2_key_display, r2_key_thumb, width, height, taken_at,
		        lat, lon, caption, alt, note, sort_order
		   FROM photos WHERE id = ?`,
	)
		.bind(id)
		.first<AdminPhoto>();
}

/** True if any photo row uses this key for its display or thumbnail image. */
export async function isKnownImageKey(r2Key: string): Promise<boolean> {
	const row = await env.DB.prepare(`SELECT 1 AS found FROM photos WHERE r2_key_display = ?1 OR r2_key_thumb = ?1`)
		.bind(r2Key)
		.first();
	return row !== null;
}

export async function slugExists(slug: string): Promise<boolean> {
	return (await env.DB.prepare('SELECT 1 AS found FROM posts WHERE slug = ?').bind(slug).first()) !== null;
}

export async function createDraftPost(input: { id: string; slug: string; title: string; createdBy: string }): Promise<void> {
	const now = new Date().toISOString();
	await env.DB.prepare(
		`INSERT INTO posts (id, slug, title, status, visibility, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, 'draft', 'public', ?, ?, ?)`,
	)
		.bind(input.id, input.slug, input.title, input.createdBy, now, now)
		.run();
}

export interface PostDetailsUpdate {
	title?: string;
	author_notes?: string;
	visibility?: PostRow['visibility'];
	trip_start?: string | null;
	trip_end?: string | null;
	location?: string;
}

const EDITABLE_POST_COLUMNS: readonly (keyof PostDetailsUpdate)[] = [
	'title',
	'author_notes',
	'visibility',
	'trip_start',
	'trip_end',
	'location',
];

export async function updatePostDetails(id: string, update: PostDetailsUpdate): Promise<boolean> {
	// Column names go into the SQL text, so only fixed, known names are allowed.
	const columns = Object.keys(update) as (keyof PostDetailsUpdate)[];
	const unknown = columns.filter((column) => !EDITABLE_POST_COLUMNS.includes(column));
	if (unknown.length > 0) throw new Error(`Not editable post fields: ${unknown.join(', ')}`);
	if (columns.length === 0) return true;
	const assignments = columns.map((column) => `${column} = ?`).join(', ');
	const result = await env.DB.prepare(`UPDATE posts SET ${assignments}, updated_at = ? WHERE id = ?`)
		.bind(...columns.map((column) => update[column] ?? null), new Date().toISOString(), id)
		.run();
	return result.meta.changes > 0;
}

export interface NewPhoto {
	id: string;
	post_id: string;
	r2_key_original: string;
	r2_key_display: string;
	r2_key_thumb: string;
	width: number;
	height: number;
	taken_at: string | null;
	lat: number | null;
	lon: number | null;
	note: string;
}

/** Inserts a photo after the post's existing photos and marks the post as updated. */
export async function insertPhoto(photo: NewPhoto): Promise<void> {
	const now = new Date().toISOString();
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO photos (id, post_id, r2_key_original, r2_key_display, r2_key_thumb, width, height,
			                     taken_at, lat, lon, note, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
			         (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM photos WHERE post_id = ?))`,
		).bind(
			photo.id,
			photo.post_id,
			photo.r2_key_original,
			photo.r2_key_display,
			photo.r2_key_thumb,
			photo.width,
			photo.height,
			photo.taken_at,
			photo.lat,
			photo.lon,
			photo.note,
			photo.post_id,
		),
		env.DB.prepare('UPDATE posts SET updated_at = ? WHERE id = ?').bind(now, photo.post_id),
	]);
}

export async function updatePhotoNote(id: string, note: string): Promise<boolean> {
	const result = await env.DB.prepare('UPDATE photos SET note = ? WHERE id = ?').bind(note, id).run();
	return result.meta.changes > 0;
}

/** Deletes a photo row and clears it as the post's cover if it was one. */
export async function deletePhotoRow(photo: Pick<AdminPhoto, 'id' | 'post_id'>): Promise<void> {
	await env.DB.batch([
		env.DB.prepare('UPDATE posts SET cover_photo_id = NULL WHERE id = ? AND cover_photo_id = ?').bind(
			photo.post_id,
			photo.id,
		),
		env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photo.id),
		env.DB.prepare('UPDATE posts SET updated_at = ? WHERE id = ?').bind(new Date().toISOString(), photo.post_id),
	]);
}
