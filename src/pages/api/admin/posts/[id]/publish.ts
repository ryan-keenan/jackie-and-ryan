import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { parseBody, referencedVideoIds } from '../../../../../lib/blocks';
import { getPhotosForAdmin, getPostForAdmin, getVideosForPost, setPublished } from '../../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../../lib/http';
import { buildSnapshot } from '../../../../../lib/snapshot';

const publishSchema = z.object({ published: z.boolean() }).strict();

/**
 * Publishes or unpublishes a post. Publishing requires a body that renders, and
 * stores a copy of the post as it is now for the live site (src/lib/snapshot.ts);
 * publishing an already-published post replaces that copy with the current edits.
 */
export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		const { published } = parseWith(publishSchema, await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);

		let snapshot: string | null = null;
		if (published) {
			const photos = await getPhotosForAdmin(post.id);
			const photoIds = photos.map((photo) => photo.id);
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
			snapshot = JSON.stringify(buildSnapshot(post, photos, videos));
		}

		await setPublished(post.id, snapshot);
		return json({ ok: true, status: published ? 'published' : 'draft' });
	});
