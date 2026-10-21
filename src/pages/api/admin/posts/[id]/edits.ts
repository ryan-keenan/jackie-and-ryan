import type { APIRoute } from 'astro';
import { getPhotosForAdmin, getPostForAdmin, getVideosForPost } from '../../../../../lib/db';
import { BadRequest, handle, json } from '../../../../../lib/http';
import { postHasUnpublishedEdits } from '../../../../../lib/post-edits';

/** Whether the post has edits the live site doesn't show yet; the admin page asks after each save. */
export const GET: APIRoute = ({ params }) =>
	handle(async () => {
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		const [photos, videos] = await Promise.all([getPhotosForAdmin(post.id), getVideosForPost(post.id)]);
		return json({ unpublishedEdits: postHasUnpublishedEdits(post, photos, videos) });
	});
