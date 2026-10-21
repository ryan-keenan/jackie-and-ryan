import Anthropic from '@anthropic-ai/sdk';
import type { APIRoute } from 'astro';
import { PlaceFailed } from '../../../../../lib/ai/place';
import { getPostForAdmin } from '../../../../../lib/db';
import { GeocodeFailed } from '../../../../../lib/geocode';
import { BadRequest, handle, json } from '../../../../../lib/http';
import { previewMapView, suggestAndSavePlace } from '../../../../../lib/post-place';

/**
 * "Find the place": the AI works out the place the post is about from its saved
 * details and text, and it is saved as the map pin and looked up. The reply has
 * the pin text, the AI's reason, the matched place and the new map preview.
 */
export const POST: APIRoute = ({ params }) =>
	handle(async () => {
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		try {
			const { suggestion, placeName } = await suggestAndSavePlace(post.id);
			return json({
				pin: suggestion.pin,
				confident: suggestion.confident,
				reason: suggestion.reason,
				placeName,
				view: await previewMapView(post.id),
			});
		} catch (error) {
			if (error instanceof PlaceFailed) throw new BadRequest(error.message, 502);
			if (error instanceof Anthropic.APIError) throw new BadRequest(`The request to Claude failed: ${error.message}`, 502);
			if (error instanceof GeocodeFailed) throw new BadRequest(`Couldn’t look the place up on the map: ${error.message}. Try again.`, 502);
			throw error;
		}
	});
