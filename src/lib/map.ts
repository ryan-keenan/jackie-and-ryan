// Maps on post pages: one labeled pin on the place the post is about, at a zoom
// level the admins choose per post. The place comes from the post's map pin text
// (which the AI suggests, see src/lib/ai/place.ts) or, without one, its Location,
// both looked up with src/lib/geocode.ts. When neither finds a place, the pin goes
// in the middle of the photos' GPS positions. Positions are rounded before they
// reach the public page so a map shows the area, not the exact spot (such as a
// home address).

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

/** Two decimal places is about 1 km: enough to show the area, not a doorstep. */
const PUBLIC_DECIMALS = 2;

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

function round(value: number): number {
	const factor = 10 ** PUBLIC_DECIMALS;
	return Math.round(value * factor) / factor;
}

type Position = { lat: number | null; lon: number | null };

/** The pin's label: the place's name, which is the map pin text (or else the Location) up to its first comma. */
export function pinLabel(mapPin: string, location: string): string {
	return (mapPin.trim() || location.trim()).split(',')[0].trim();
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
		return { mode, source: 'place', pin: [round(place.lon), round(place.lat)], label: place.label, zoom: ZOOM[mode] };
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

/** What the admin page says about where the pin comes from. */
export function mapSourceHint(placeName: string, located: number): string {
	const rounding = 'The pin is placed to within about 1 km, never the exact spot.';
	if (placeName) {
		return `The pin marks ${placeName}. If that's the wrong place, edit the map pin (for example, add the state) or use Find the place. ${rounding}`;
	}
	if (located > 0) {
		return `No place was found for the map pin, so it marks the middle of the ${located} photo${located === 1 ? '' : 's'} with a location. Use Find the place, or type a place. ${rounding}`;
	}
	return 'No place was found for the map pin and no photo has a location, so there’s no map. Use Find the place, or type a place.';
}
