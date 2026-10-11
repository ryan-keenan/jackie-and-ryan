import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { bodySchema, parseBody } from '../../../../../lib/blocks';
import { getPhotosForAdmin, updatePostContent } from '../../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../../lib/http';

const contentSchema = z
	.object({
		body: bodySchema,
		summary: z.string().trim().max(500),
		cover_photo_id: z.string().min(1).nullable(),
	})
	.strict();

/** Saves the post body from the editor. Every referenced photo must belong to the post. */
export const PUT: APIRoute = ({ params, request }) =>
	handle(async () => {
		const content = parseWith(contentSchema, await readJson(request));
		const photoIds = (await getPhotosForAdmin(params.id!)).map((photo) => photo.id);
		const body = JSON.stringify(content.body);
		try {
			parseBody(body, photoIds);
		} catch (error) {
			throw new BadRequest((error as Error).message);
		}
		if (content.cover_photo_id && !photoIds.includes(content.cover_photo_id)) {
			throw new BadRequest('The cover photo is not one of this post’s photos');
		}
		if (!(await updatePostContent(params.id!, { ...content, body }))) throw new BadRequest('Post not found', 404);
		return json({ ok: true });
	});
