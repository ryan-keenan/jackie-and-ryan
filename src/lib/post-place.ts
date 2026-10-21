import { env } from 'cloudflare:workers';
import { findPlace, placeRequestPost, readPlaceConfig, type PlaceSuggestion } from './ai/place';
import { parseBody } from './blocks';
import { getPhotosForAdmin, getPostForAdmin, getVideosForPost, updatePostDetails, type PostDetailsUpdate } from './db';
import { geocodePlace } from './geocode';
import { mapView, pinLabel, type MapView } from './map';

// The post's map pin: the AI suggests the place a post is about, and the pin
// text (or, without one, the Location) is looked up on the map.

/** Looks up the text the map pin uses and returns the place columns to store. Throws GeocodeFailed if the lookup service fails. */
export async function placeColumns(mapPin: string, location: string): Promise<Required<Pick<PostDetailsUpdate, 'place_lat' | 'place_lon' | 'place_name'>>> {
	const text = mapPin.trim() || location.trim();
	const found = text ? await geocodePlace(text) : null;
	return { place_lat: found?.lat ?? null, place_lon: found?.lon ?? null, place_name: found?.name ?? '' };
}

/** Asks the AI where a post is, from its saved details, notes, captions and text. */
export async function suggestPlace(postId: string): Promise<PlaceSuggestion> {
	const post = await getPostForAdmin(postId);
	if (!post) throw new Error('The post was deleted');
	const [photos, videos] = await Promise.all([getPhotosForAdmin(post.id), getVideosForPost(post.id)]);
	const blocks = parseBody(post.body, photos.map((photo) => photo.id), videos.map((video) => video.id));
	return findPlace(readPlaceConfig(env), placeRequestPost(post, post.author_notes, photos, videos, blocks));
}

/** Suggests a post's place, saves it as the map pin and looks it up. Returns the suggestion and the matched place name. */
export async function suggestAndSavePlace(postId: string): Promise<{ suggestion: PlaceSuggestion; placeName: string }> {
	const suggestion = await suggestPlace(postId);
	const post = await getPostForAdmin(postId);
	if (!post) throw new Error('The post was deleted');
	const place = await placeColumns(suggestion.pin, post.location);
	await updatePostDetails(postId, { map_pin: suggestion.pin, ...place });
	return { suggestion, placeName: place.place_name };
}

/** The admin page's map preview for a post: always the 'fit' view, so turning the map on shows it right away. */
export async function previewMapView(postId: string): Promise<MapView | null> {
	const post = await getPostForAdmin(postId);
	if (!post) throw new Error('The post was deleted');
	const photos = await getPhotosForAdmin(post.id);
	return mapView('fit', photos, { lat: post.place_lat, lon: post.place_lon, label: pinLabel(post.map_pin, post.location) });
}
