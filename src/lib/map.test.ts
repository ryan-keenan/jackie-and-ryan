import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { locatedCount, MAP_STYLE_LABELS, MAP_STYLES, mapView } from './map';

const taipei = { lat: 25.033964, lon: 121.564468 };
const nearby = { lat: 25.031101, lon: 121.56012 }; // ~500 m away, in the same rounded ~1 km cell
const longdong = { lat: 25.1103, lon: 121.9221 };
const noGps = { lat: null, lon: null };
const noPlace = noGps;

describe('mapView', () => {
	it('returns nothing when the map is off or neither the photos nor the place has a position', () => {
		expect(mapView('off', [taipei], noPlace)).toBeNull();
		expect(mapView('country', [noGps, noGps], noPlace)).toBeNull();
	});

	it('rounds positions to about 1 km and drops duplicates', () => {
		const view = mapView('city', [taipei, nearby, noGps, longdong], noPlace)!;
		expect(view.points).toEqual([
			[121.56, 25.03],
			[121.92, 25.11],
		]);
	});

	it('centers on the middle of the photos and sets the zoom for fixed modes', () => {
		const view = mapView('country', [taipei, longdong], noPlace)!;
		expect(view.center).toEqual([121.74, 25.07]);
		expect(view.zoom).toBe(4.2);
		expect(view.bounds).toEqual([121.56, 25.03, 121.92, 25.11]);
	});

	it('leaves zoom to the bounds in fit mode', () => {
		expect(mapView('fit', [taipei, longdong], noPlace)!.zoom).toBeNull();
	});
});

describe('mapView with the post\'s place', () => {
	it('uses the place only when no photo has a position', () => {
		const place = { lat: 39.3415556, lon: -120.3399113 };
		const view = mapView('fit', [noGps], place)!;
		expect(view.source).toBe('place');
		expect(view.points).toEqual([[-120.34, 39.34]]);
		expect(mapView('fit', [taipei], place)!.source).toBe('photos');
		expect(mapView('off', [noGps], place)).toBeNull();
	});
});

describe('locatedCount', () => {
	it('counts photos with both coordinates', () => {
		expect(locatedCount([taipei, noGps, { lat: 1, lon: null }])).toBe(1);
	});
});

describe('MAP_STYLES', () => {
	it('matches the database constraint and has a label for each style', () => {
		const migration = readFileSync(new URL('../../migrations/0006_map_style.sql', import.meta.url), 'utf8');
		const allowed = [...migration.match(/map_style IN \(([^)]*)\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
		expect(allowed).toEqual([...MAP_STYLES]);
		expect(Object.keys(MAP_STYLE_LABELS)).toEqual([...MAP_STYLES]);
	});
});
