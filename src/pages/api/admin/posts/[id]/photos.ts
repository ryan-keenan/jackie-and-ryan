import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import { getPhotoForAdmin, getPostForAdmin, insertPhoto } from '../../../../../lib/db';
import { BadRequest, handle, json, parseWith } from '../../../../../lib/http';

// The browser resizes each photo before upload (src/scripts/admin-upload.ts) and
// sends four files plus metadata read from the photo's EXIF data:
//   original  the file as taken; kept for the record, never served publicly
//   display   JPEG, at most 2400px on the long edge, metadata stripped
//   ai        JPEG, at most 1568px, sent to the AI drafter; never served
//   thumb     JPEG, at most 600px on the long edge, metadata stripped

const MB = 1024 * 1024;

const ORIGINAL_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/heic': 'heic',
	'image/heif': 'heif',
	'image/webp': 'webp',
};

const metaSchema = z.object({
	width: z.number().int().min(1).max(10_000),
	height: z.number().int().min(1).max(10_000),
	// Camera wall-clock time, e.g. "2026-01-10T19:32:00+08:00", or without an offset if the camera didn't record one
	taken_at: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/)
		.nullable(),
	lat: z.number().min(-90).max(90).nullable(),
	lon: z.number().min(-180).max(180).nullable(),
	note: z.string().trim().max(500),
});

function requireFile(form: FormData, name: string, types: string[], maxBytes: number): File {
	const file = form.get(name);
	if (!(file instanceof File)) throw new BadRequest(`Missing ${name} file`);
	if (!types.includes(file.type)) throw new BadRequest(`${name} has unsupported type "${file.type || 'unknown'}"`);
	if (file.size === 0 || file.size > maxBytes) {
		throw new BadRequest(`${name} must be between 1 byte and ${maxBytes / MB}MB`);
	}
	return file;
}

export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		const postId = params.id!;
		if (!(await getPostForAdmin(postId))) throw new BadRequest('Post not found', 404);

		const form = await request.formData();
		const original = requireFile(form, 'original', Object.keys(ORIGINAL_TYPES), 60 * MB);
		const display = requireFile(form, 'display', ['image/jpeg'], 15 * MB);
		const ai = requireFile(form, 'ai', ['image/jpeg'], 8 * MB);
		const thumb = requireFile(form, 'thumb', ['image/jpeg'], 2 * MB);
		let rawMeta: unknown;
		try {
			rawMeta = JSON.parse(String(form.get('meta')));
		} catch {
			throw new BadRequest('meta is not valid JSON');
		}
		const meta = parseWith(metaSchema, rawMeta);

		const id = crypto.randomUUID();
		const prefix = `photos/${postId}/${id}`;
		const keys = {
			original: `${prefix}/original.${ORIGINAL_TYPES[original.type]}`,
			display: `${prefix}/display.jpg`,
			ai: `${prefix}/ai.jpg`,
			thumb: `${prefix}/thumb.jpg`,
		};

		await Promise.all([
			env.PHOTOS.put(keys.original, original.stream(), { httpMetadata: { contentType: original.type } }),
			env.PHOTOS.put(keys.display, display.stream(), { httpMetadata: { contentType: 'image/jpeg' } }),
			env.PHOTOS.put(keys.ai, ai.stream(), { httpMetadata: { contentType: 'image/jpeg' } }),
			env.PHOTOS.put(keys.thumb, thumb.stream(), { httpMetadata: { contentType: 'image/jpeg' } }),
		]);

		try {
			await insertPhoto({
				id,
				post_id: postId,
				r2_key_original: keys.original,
				r2_key_display: keys.display,
				r2_key_ai: keys.ai,
				r2_key_thumb: keys.thumb,
				...meta,
			});
		} catch (error) {
			// Don't leave files in storage that no database row points to.
			await env.PHOTOS.delete(Object.values(keys));
			throw error;
		}

		return json(await getPhotoForAdmin(id), 201);
	});
