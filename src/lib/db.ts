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
