// Maps on post pages: one labeled pin on the place the post is about, at a zoom
// level the admins choose per post. The place comes from "Find the place"
// (src/lib/ai/place.ts, usually coordinates from a web page) or, for a post that
// has never had one found, its Location looked up with src/lib/geocode.ts. When
// neither gives a place, the pin goes in the middle of the photos' GPS positions.
// Positions are rounded before they reach the public page: photo positions to
// about 1 km, so a map never marks where someone was standing (such as a home
// address), and named public places to about 100 m.

export const MAP_MODES = ['off', 'fit', 'city', 'region', 'country', 'world'] as const;
export type MapMode = (typeof MAP_MODES)[number];

export const MAP_MODE_LABELS: Record<MapMode, string> = {
	off: 'No map',
	fit: 'The area around the place',
	city: 'City',
	region: 'Region or state',
	country: 'Country',
	world: 'World',
};

/**
 * How the map is drawn. All are free for a non-commercial site; the drawing
 * code is in src/scripts/trip-map.ts. Keep this list in step with the CHECK
 * constraint in migrations/0006_map_style.sql.
 */
export const MAP_STYLES = ['light', 'light-topo', 'old-world', 'satellite', 'satellite-topo', 'terrain-3d', 'liberty', 'fiord', 'globe'] as const;
export type MapStyle = (typeof MAP_STYLES)[number];

export const MAP_STYLE_LABELS: Record<MapStyle, string> = {
	light: 'Light',
	'light-topo': 'Light topo (relief and contours)',
	'old-world': 'Old-world',
	satellite: 'Satellite',
	'satellite-topo': 'Satellite with contours',
	'terrain-3d': '3D terrain',
	liberty: 'Classic',
	fiord: 'Moody blue',
	globe: 'Globe (always shows the whole planet)',
};

/**
 * MapLibre zoom level for each mode. 'fit' shows roughly 80 to 150 km across,
 * depending on screen width, so the nearest city is in view for orientation.
 */
export const ZOOM: Record<Exclude<MapMode, 'off'>, number> = {
	fit: 9.3,
	city: 11,
	region: 6.5,
	country: 4.2,
	world: 1.3,
};

/** Decimal places kept: 2 is about 1 km, enough to show the area but not a doorstep; 3 is about 100 m. */
const PHOTO_DECIMALS = 2;
const PLACE_DECIMALS = 3;

export type LonLat = [number, number];

export interface MapView {
	mode: Exclude<MapMode, 'off'>;
	/** 'place' when the pin is the looked-up map pin or Location, 'photos' when it is the middle of the photos' GPS. */
	source: 'place' | 'photos';
	/** The one pin, rounded. */
	pin: LonLat;
	/** Text shown next to the pin; empty for none. */
	label: string;
	zoom: number;
}

function round(value: number, decimals = PHOTO_DECIMALS): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

type Position = { lat: number | null; lon: number | null };

/** The pin's label: the map pin (the found place's name), or else the Location up to its first comma. */
export function pinLabel(mapPin: string, location: string): string {
	return mapPin.trim() || location.split(',')[0].trim();
}

/**
 * The map for a post: a pin on its looked-up place, or in the middle of the
 * photos' positions when there is no place. Null when the map is off or there
 * is neither. Antimeridian-spanning photo sets (e.g. Fiji) would center oddly;
 * none are expected, so that case is not handled.
 */
export function mapView(mode: MapMode, photos: Position[], place: Position & { label: string }): MapView | null {
	if (mode === 'off') return null;
	if (place.lat !== null && place.lon !== null) {
		return { mode, source: 'place', pin: [round(place.lon, PLACE_DECIMALS), round(place.lat, PLACE_DECIMALS)], label: place.label, zoom: ZOOM[mode] };
	}
	const located = photos.filter((p): p is { lat: number; lon: number } => p.lat !== null && p.lon !== null);
	if (located.length === 0) return null;
	const lons = located.map((p) => p.lon);
	const lats = located.map((p) => p.lat);
	const pin: LonLat = [round((Math.min(...lons) + Math.max(...lons)) / 2), round((Math.min(...lats) + Math.max(...lats)) / 2)];
	return { mode, source: 'photos', pin, label: '', zoom: ZOOM[mode] };
}

/** How many photos have a GPS position, for the admin page. */
export function locatedCount(photos: { lat: number | null; lon: number | null }[]): number {
	return photos.filter((p) => p.lat !== null && p.lon !== null).length;
}

/** The admin page's description of a host name, e.g. "peakbagger.com". */
export function sourceHost(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}

/** What the admin page says about where the pin is. The page links the coordinates' source separately. */
export function mapSourceHint(place: { name: string; source: string; lat: number | null; lon: number | null }, located: number): string {
	if (place.lat !== null && place.lon !== null && place.name) {
		const at = `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`;
		const from = place.source ? `coordinates from ${sourceHost(place.source)}` : 'matched on OpenStreetMap';
		return `The pin marks ${place.name} at ${at} (${from}). To move it, type a place and use Find the place.`;
	}
	if (located > 0) {
		return `No place has been found yet, so the pin marks the middle of the ${located} photo${located === 1 ? '' : 's'} with a location, to within about 1 km. Use Find the place.`;
	}
	return 'No place has been found yet and no photo has a location, so there’s no map. Use Find the place.';
}
