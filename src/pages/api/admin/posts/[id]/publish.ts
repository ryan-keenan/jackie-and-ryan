import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { parseBody } from '../../../../../lib/blocks';
import { getPhotosForAdmin, getPostForAdmin, setPublished } from '../../../../../lib/db';
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
			let blockCount: number;
			try {
				blockCount = parseBody(post.body, photoIds).length;
			} catch (error) {
				throw new BadRequest(`The post can't be published: ${(error as Error).message}`);
			}
			if (blockCount === 0) throw new BadRequest('The post is empty. Generate a draft or add content first.');
		}

		await setPublished(post.id, published);
		return json({ ok: true, status: published ? 'published' : 'draft' });
	});
