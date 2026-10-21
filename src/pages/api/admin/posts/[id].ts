import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { MAP_MODES, MAP_STYLES } from '../../../../lib/map';
import { getPostForAdmin, updatePostDetails, type PostDetailsUpdate } from '../../../../lib/db';
import { GeocodeFailed } from '../../../../lib/geocode';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../lib/http';
import { placeColumns, previewMapView } from '../../../../lib/post-place';

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
		map_pin: z.string().trim().max(200),
	})
	.partial()
	.strict()
	.refine((d) => !d.trip_start || !d.trip_end || d.trip_start <= d.trip_end, {
		message: 'Trip end is before trip start',
		path: ['trip_end'],
	});

// The map pin marks the place the map pin text names or, without one, the
// Location's. When the text it uses changes, it is looked up again, and the reply
// includes the matched place (null for no match) and the new map preview so the
// page can show them. A failed lookup fails the save rather than leaving the pin
// on the old place.
export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const details = parseWith(detailsSchema, await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		const update: PostDetailsUpdate = { ...details };
		const mapPin = details.map_pin ?? post.map_pin;
		const location = details.location ?? post.location;
		const lookupText = (pin: string, fallback: string) => pin.trim() || fallback.trim();
		let place: { name: string } | null | undefined;
		if (lookupText(mapPin, location) !== lookupText(post.map_pin, post.location)) {
			try {
				Object.assign(update, await placeColumns(mapPin, location));
			} catch (error) {
				if (!(error instanceof GeocodeFailed)) throw error;
				throw new BadRequest(`Not saved: couldn\u2019t look up the map pin. ${error.message}. Try again.`, 502);
			}
			place = update.place_name ? { name: update.place_name } : null;
		}
		if (!(await updatePostDetails(post.id, update))) throw new BadRequest('Post not found', 404);
		return json({ ok: true, place, view: place === undefined ? undefined : await previewMapView(post.id) });
	});
