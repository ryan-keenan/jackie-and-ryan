import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import { parseBody, referencedPhotoIds } from '../../../../lib/blocks';
import { deletePhotoRow, getPhotoForAdmin, getPhotosForAdmin, getPostForAdmin, updatePhotoNote } from '../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../lib/http';

const noteSchema = z.object({ note: z.string().trim().max(500) }).strict();

export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const { note } = parseWith(noteSchema, await readJson(request));
		if (!(await updatePhotoNote(params.id!, note))) throw new BadRequest('Photo not found', 404);
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
		const body = parseBody(post!.body, photos.map((p) => p.id));
		if (referencedPhotoIds(body).includes(photo.id)) {
			throw new BadRequest('This photo is used in the post. Remove it from the post before deleting it.', 409);
		}

		await deletePhotoRow(photo);
		await env.PHOTOS.delete([photo.r2_key_original, photo.r2_key_display, photo.r2_key_thumb]);
		return json({ ok: true });
	});
