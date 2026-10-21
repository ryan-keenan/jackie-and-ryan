import { env } from 'cloudflare:workers';
import { findPlace, PlaceFailed, placeRequestPost, readPlaceConfig, type PlaceSuggestion } from './ai/place';
import { parseBody } from './blocks';
import { getPhotosForAdmin, getPostForAdmin, getVideosForPost, updatePostDetails, type PostDetailsUpdate } from './db';
import { geocodePlace } from './geocode';
import { mapView, pinLabel, type MapView } from './map';

// The post's map pin. "Find the place" asks the AI for the place (from the post,
// or the place the admins typed) and puts the pin at the coordinates a web page
// gives for it. A post that has never had a place found uses its Location,
// looked up on OpenStreetMap.

type PlaceColumns = Required<Pick<PostDetailsUpdate, 'place_lat' | 'place_lon' | 'place_name' | 'place_source'>>;

/** Looks up a Location on OpenStreetMap. Throws GeocodeFailed if the lookup service fails. */
export async function locationPlaceColumns(location: string): Promise<PlaceColumns> {
	const found = location.trim() ? await geocodePlace(location) : null;
	return { place_lat: found?.lat ?? null, place_lon: found?.lon ?? null, place_name: found?.name ?? '', place_source: '' };
}

/**
 * The pin for a suggestion: its coordinates, or when no web page gave any, its map
 * search looked up on OpenStreetMap. Fails when neither gives a position, rather
 * than keeping the old pin under a new label.
 */
async function suggestionPlaceColumns(suggestion: PlaceSuggestion): Promise<PlaceColumns> {
	if (suggestion.coordinates) {
		const { lat, lon, source } = suggestion.coordinates;
		return { place_lat: lat, place_lon: lon, place_name: suggestion.label, place_source: source?.url ?? '' };
	}
	const found = await geocodePlace(suggestion.search);
	if (!found) {
		throw new PlaceFailed(`No web page gave coordinates for ${suggestion.label}, and the map doesn't know "${suggestion.search}". Try a more specific place.`);
	}
	return { place_lat: found.lat, place_lon: found.lon, place_name: found.name, place_source: '' };
}

/** Asks the AI where a post is (or where `request` is), from its saved details, notes, captions and text. */
export async function suggestPlace(postId: string, request = ''): Promise<PlaceSuggestion> {
	const post = await getPostForAdmin(postId);
	if (!post) throw new Error('The post was deleted');
	const [photos, videos] = await Promise.all([getPhotosForAdmin(post.id), getVideosForPost(post.id)]);
	const blocks = parseBody(post.body, photos.map((photo) => photo.id), videos.map((video) => video.id));
	return findPlace(readPlaceConfig(env), placeRequestPost(post, post.author_notes, photos, videos, blocks, request));
}

/** Finds a post's place, saves its label as the map pin and moves the pin there. */
export async function suggestAndSavePlace(postId: string, request = ''): Promise<{ suggestion: PlaceSuggestion; place: PlaceColumns }> {
	const suggestion = await suggestPlace(postId, request);
	const place = await suggestionPlaceColumns(suggestion);
	await updatePostDetails(postId, { map_pin: suggestion.label, ...place });
	return { suggestion, place };
}

/** The admin page's map preview for a post: always the 'fit' view, so turning the map on shows it right away. */
export async function previewMapView(postId: string): Promise<MapView | null> {
	const post = await getPostForAdmin(postId);
	if (!post) throw new Error('The post was deleted');
	const photos = await getPhotosForAdmin(post.id);
	return mapView('fit', photos, { lat: post.place_lat, lon: post.place_lon, label: pinLabel(post.map_pin, post.location) });
}
