import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { parseBody, referencedVideoIds } from '../../../../../lib/blocks';
import { getPhotosForAdmin, getPostForAdmin, getVideosForPost, setPublished } from '../../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../../lib/http';

const publishSchema = z.object({ published: z.boolean() }).strict();

/** Publishes or unpublishes a post. Publishing requires a body that renders. */
export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		const { published } = parseWith(publishSchema, await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);

		if (published) {
			const photoIds = (await getPhotosForAdmin(post.id)).map((photo) => photo.id);
			const videos = await getVideosForPost(post.id);
			let blocks;
			try {
				blocks = parseBody(post.body, photoIds, videos.map((video) => video.id));
			} catch (error) {
				throw new BadRequest(`The post can't be published: ${(error as Error).message}`);
			}
			if (blocks.length === 0) throw new BadRequest('The post is empty. Generate a draft or add content first.');
			const used = new Set(referencedVideoIds(blocks));
			const notReady = videos.filter((video) => used.has(video.id) && video.status !== 'ready');
			if (notReady.length > 0) {
				throw new BadRequest(
					`${notReady.length} video(s) in the post aren't ready to play yet. Wait for processing to finish, or remove them.`,
				);
			}
		}

		await setPublished(post.id, published);
		return json({ ok: true, status: published ? 'published' : 'draft' });
	});
