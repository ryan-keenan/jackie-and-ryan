import Anthropic from '@anthropic-ai/sdk';
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { PlaceFailed } from '../../../../../lib/ai/place';
import { getPostForAdmin } from '../../../../../lib/db';
import { GeocodeFailed } from '../../../../../lib/geocode';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../../lib/http';
import { previewMapView, suggestAndSavePlace } from '../../../../../lib/post-place';

const findSchema = z.object({ request: z.string().trim().max(200) }).strict();

/**
 * "Find the place": the AI finds the place the admins typed (`request`), or
 * without one the place the post is about, and its coordinates on the web. The
 * pin moves there and its label is saved as the map pin. The reply has the label,
 * the AI's reason, the pin's place and source, and the new map preview.
 */
export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		const { request: wanted } = parseWith(findSchema, await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		try {
			const { suggestion, place } = await suggestAndSavePlace(post.id, wanted);
			return json({
				label: suggestion.label,
				confident: suggestion.confident,
				reason: suggestion.reason,
				place: { name: place.place_name, source: place.place_source, lat: place.place_lat, lon: place.place_lon },
				sourceVerified: suggestion.coordinates?.source?.verified ?? null,
				view: await previewMapView(post.id),
			});
		} catch (error) {
			if (error instanceof PlaceFailed) throw new BadRequest(error.message, 502);
			if (error instanceof Anthropic.APIError) throw new BadRequest(`The request to Claude failed: ${error.message}`, 502);
			if (error instanceof GeocodeFailed) throw new BadRequest(`Couldn’t look the place up on the map: ${error.message}. Try again.`, 502);
			throw error;
		}
	});
