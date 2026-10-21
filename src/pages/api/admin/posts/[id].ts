import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { MAP_MODES, MAP_STYLES } from '../../../../lib/map';
import { getPostForAdmin, updatePostDetails, type PostDetailsUpdate } from '../../../../lib/db';
import { GeocodeFailed } from '../../../../lib/geocode';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../lib/http';
import { locationPlaceColumns, previewMapView } from '../../../../lib/post-place';

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

// A post whose place has never been found (no map pin) has its pin on the
// Location, so a changed Location is looked up again, and the reply includes the
// matched place (null for no match) and the new map preview so the page can show
// them. A failed lookup fails the save rather than leaving the pin on the old
// place. Posts with a map pin keep it until "Find the place" is used again.
export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const details = parseWith(detailsSchema, await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		const update: PostDetailsUpdate = { ...details };
		let place: { name: string; source: string; lat: number | null; lon: number | null } | undefined;
		if (!post.map_pin.trim() && details.location !== undefined && details.location !== post.location) {
			try {
				Object.assign(update, await locationPlaceColumns(details.location));
			} catch (error) {
				if (!(error instanceof GeocodeFailed)) throw error;
				throw new BadRequest(`Not saved: couldn\u2019t look up the Location for the map. ${error.message}. Try again.`, 502);
			}
			place = { name: update.place_name ?? '', source: '', lat: update.place_lat ?? null, lon: update.place_lon ?? null };
		}
		if (!(await updatePostDetails(post.id, update))) throw new BadRequest('Post not found', 404);
		return json({ ok: true, place, view: place === undefined ? undefined : await previewMapView(post.id) });
	});
