import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import { parseBody, referencedPhotoIds } from '../../../../lib/blocks';
import { deletePhotoRow, getPhotoForAdmin, getPhotosForAdmin, getPostForAdmin, getVideosForPost, updatePhotoText } from '../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../lib/http';
import { publishedMediaIds } from '../../../../lib/snapshot';

const textSchema = z
	.object({
		note: z.string().trim().max(500),
		caption: z.string().trim().max(500),
		alt: z.string().trim().max(500),
	})
	.partial()
	.strict();

export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const text = parseWith(textSchema, await readJson(request));
		if (!(await updatePhotoText(params.id!, text))) throw new BadRequest('Photo not found', 404);
		return json({ ok: true });
	});

export const DELETE: APIRoute = ({ params }) =>
	handle(async () => {
		const photo = await getPhotoForAdmin(params.id!);
		if (!photo) throw new BadRequest('Photo not found', 404);

		// A post body that points at a deleted photo would fail to render, so a
		// photo used in the post has to be taken out of the post first.
		const post = await getPostForAdmin(photo.post_id);
		const photos = await getPhotosForAdmin(photo.post_id);
		const videos = await getVideosForPost(photo.post_id);
		const body = parseBody(post!.body, photos.map((p) => p.id), videos.map((v) => v.id));
		if (referencedPhotoIds(body).includes(photo.id)) {
			throw new BadRequest('This photo is used in the post. Remove it from the post before deleting it.', 409);
		}
		// The live site shows the published copy, which can still use a photo the edits have dropped.
		if (publishedMediaIds(post!).photos.includes(photo.id)) {
			throw new BadRequest('The published post still shows this photo. Publish your changes first, then delete it.', 409);
		}

		await deletePhotoRow(photo);
		await env.PHOTOS.delete(
			[photo.r2_key_original, photo.r2_key_display, photo.r2_key_thumb, photo.r2_key_ai].filter((key): key is string => !!key),
		);
		return json({ ok: true });
	});
