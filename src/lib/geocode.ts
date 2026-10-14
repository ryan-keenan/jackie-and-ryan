// Turns a post's Location text ("Squamish, British Columbia") into a map
// position, using OpenStreetMap's free Nominatim service (no key). Its usage
// policy asks for an identifying User-Agent and at most one request per second;
// lookups only happen when an admin changes a post's Location.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'jackieandryan.us journal (post map lookup)';

export interface Place {
	lat: number;
	lon: number;
	/** The matched place's full name, e.g. "Donner Summit, Nevada County, California, United States". */
	name: string;
}

export class GeocodeFailed extends Error {}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The queries to try, most specific first: the full text, then with leading
 * comma-separated parts dropped, so "Black Wall, Donner Summit" (a crag the map
 * doesn't know) still finds Donner Summit.
 */
export function placeQueries(location: string): string[] {
	const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
	return parts.map((_, i) => parts.slice(i).join(', '));
}

async function search(query: string, fetchFn: Fetch): Promise<Place | null> {
	const url = `${NOMINATIM_URL}?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' })}`;
	const response = await fetchFn(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
	if (!response.ok) throw new GeocodeFailed(`The map lookup service returned HTTP ${response.status}`);
	const results = (await response.json()) as { lat: string; lon: string; display_name: string }[];
	const first = results[0];
	if (!first) return null;
	const lat = Number(first.lat);
	const lon = Number(first.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		throw new GeocodeFailed(`The map lookup service returned an unreadable position for "${query}"`);
	}
	return { lat, lon, name: first.display_name };
}

/** The place a Location names, or null when nothing matches. Throws if the service fails. */
export async function geocodePlace(location: string, fetchFn: Fetch = fetch): Promise<Place | null> {
	for (const query of placeQueries(location)) {
		const place = await search(query, fetchFn);
		if (place) return place;
	}
	return null;
}
