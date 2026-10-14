// Maps on post pages: where the photos were taken, at a zoom level the admins
// choose per post. When no photo has a GPS position, the map shows the place the
// post's Location names instead (see src/lib/geocode.ts). Positions are rounded
// before they reach the public page so a map shows the area, not the exact spot
// (such as a home address).

export const MAP_MODES = ['off', 'fit', 'city', 'region', 'country', 'world'] as const;
export type MapMode = (typeof MAP_MODES)[number];

export const MAP_MODE_LABELS: Record<MapMode, string> = {
	off: 'No map',
	fit: 'The area where the photos were taken',
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

/** MapLibre zoom level for each fixed mode. */
export const ZOOM: Record<Exclude<MapMode, 'off' | 'fit'>, number> = {
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
	/** 'photos' when built from photo GPS, 'place' when from the post's Location. */
	source: 'photos' | 'place';
	/** Distinct, rounded positions. */
	points: LonLat[];
	center: LonLat;
	/** Set for fixed modes; 'fit' uses bounds instead. */
	zoom: number | null;
	/** [west, south, east, north], for 'fit'. */
	bounds: [number, number, number, number];
}

function round(value: number): number {
	const factor = 10 ** PUBLIC_DECIMALS;
	return Math.round(value * factor) / factor;
}

type Position = { lat: number | null; lon: number | null };

/**
 * The map for a post: from the photos' positions, or from the post's looked-up
 * place when no photo has one. Null when the map is off or neither exists.
 * Antimeridian-spanning trips (e.g. Fiji) would center oddly; none are expected,
 * so that case is not handled.
 */
export function mapView(mode: MapMode, photos: Position[], place: Position): MapView | null {
	if (mode === 'off') return null;
	const fromPhotos = points(photos);
	const source = fromPhotos.length > 0 ? 'photos' : 'place';
	const all = source === 'photos' ? fromPhotos : points([place]);
	if (all.length === 0) return null;

	const lons = all.map((p) => p[0]);
	const lats = all.map((p) => p[1]);
	const bounds: MapView['bounds'] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
	const center: LonLat = [round((bounds[0] + bounds[2]) / 2), round((bounds[1] + bounds[3]) / 2)];
	return { mode, source, points: all, center, zoom: mode === 'fit' ? null : ZOOM[mode], bounds };
}

/** Distinct positions, rounded to about 1 km. */
function points(positions: Position[]): LonLat[] {
	const seen = new Set<string>();
	const points: LonLat[] = [];
	for (const { lat, lon } of positions) {
		if (lat === null || lon === null) continue;
		const point: LonLat = [round(lon), round(lat)];
		const key = point.join(',');
		if (!seen.has(key)) {
			seen.add(key);
			points.push(point);
		}
	}
	return points;
}

/** How many photos have a GPS position, for the admin page. */
export function locatedCount(photos: { lat: number | null; lon: number | null }[]): number {
	return photos.filter((p) => p.lat !== null && p.lon !== null).length;
}

/** What the admin page says about where the map comes from. */
export function mapSourceHint(located: number, total: number, placeName: string): string {
	const pins = 'Pins are placed to within about 1 km, never the exact spot.';
	if (located > 0) return `${located} of ${total} photos have a location. ${pins}`;
	if (placeName) {
		return `No photo has a location, so the map shows the Location: ${placeName}. If that's the wrong place, make the Location more specific (for example, add the county).`;
	}
	return 'No photo has a location and the Location didn’t match a place, so there’s no map. Try a nearby town or landmark.';
}
