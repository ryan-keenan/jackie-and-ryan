import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { updatePostDetails } from '../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../lib/http';

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
	.refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Not a real date');

// Every field is optional so the page can save one field at a time.
const detailsSchema = z
	.object({
		title: z.string().trim().min(1, 'Title cannot be empty').max(200),
		author_notes: z.string().max(20_000),
		visibility: z.enum(['public', 'private']),
		trip_start: isoDate.nullable(),
		trip_end: isoDate.nullable(),
		location: z.string().trim().max(200),
	})
	.partial()
	.strict()
	.refine((d) => !d.trip_start || !d.trip_end || d.trip_start <= d.trip_end, {
		message: 'Trip end is before trip start',
		path: ['trip_end'],
	});

export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const update = parseWith(detailsSchema, await readJson(request));
		if (!(await updatePostDetails(params.id!, update))) throw new BadRequest('Post not found', 404);
		return json({ ok: true });
	});
