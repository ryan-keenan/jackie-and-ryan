import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { MAP_MODES, MAP_STYLES } from '../../../../lib/map';
import { getPostForAdmin, updatePostDetails, type PostDetailsUpdate } from '../../../../lib/db';
import { GeocodeFailed, geocodePlace } from '../../../../lib/geocode';
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
		map_mode: z.enum(MAP_MODES),
		map_style: z.enum(MAP_STYLES),
	})
	.partial()
	.strict()
	.refine((d) => !d.trip_start || !d.trip_end || d.trip_start <= d.trip_end, {
		message: 'Trip end is before trip start',
		path: ['trip_end'],
	});

// When the Location changes, it is looked up so the map has a place to show when
// no photo has GPS. The reply includes the matched place (or null for no match)
// so the page can show it; a failed lookup fails the save rather than leaving
// the map pointing at the old place.
export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const details = parseWith(detailsSchema, await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		const update: PostDetailsUpdate = { ...details };
		let place: { name: string } | null | undefined;
		if (details.location !== undefined && details.location !== post.location) {
			let found;
			try {
				found = details.location ? await geocodePlace(details.location) : null;
			} catch (error) {
				if (!(error instanceof GeocodeFailed)) throw error;
				throw new BadRequest(`Not saved: couldn\u2019t look up the Location for the map. ${error.message}. Try again.`, 502);
			}
			update.place_lat = found?.lat ?? null;
			update.place_lon = found?.lon ?? null;
			update.place_name = found?.name ?? '';
			place = found ? { name: found.name } : null;
		}
		if (!(await updatePostDetails(post.id, update))) throw new BadRequest('Post not found', 404);
		return json({ ok: true, place });
	});
