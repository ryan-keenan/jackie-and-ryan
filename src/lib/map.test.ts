import { describe, expect, it } from 'vitest';
import { locatedCount, mapView } from './map';

const taipei = { lat: 25.033964, lon: 121.564468 };
const nearby = { lat: 25.031101, lon: 121.56012 }; // ~500 m away, in the same rounded ~1 km cell
const longdong = { lat: 25.1103, lon: 121.9221 };
const noGps = { lat: null, lon: null };

describe('mapView', () => {
	it('returns nothing when the map is off or no photo has a position', () => {
		expect(mapView('off', [taipei])).toBeNull();
		expect(mapView('country', [noGps, noGps])).toBeNull();
	});

	it('rounds positions to about 1 km and drops duplicates', () => {
		const view = mapView('city', [taipei, nearby, noGps, longdong])!;
		expect(view.points).toEqual([
			[121.56, 25.03],
			[121.92, 25.11],
		]);
	});

	it('centers on the middle of the photos and sets the zoom for fixed modes', () => {
		const view = mapView('country', [taipei, longdong])!;
		expect(view.center).toEqual([121.74, 25.07]);
		expect(view.zoom).toBe(4.2);
		expect(view.bounds).toEqual([121.56, 25.03, 121.92, 25.11]);
	});

	it('leaves zoom to the bounds in fit mode', () => {
		expect(mapView('fit', [taipei, longdong])!.zoom).toBeNull();
	});
});

describe('locatedCount', () => {
	it('counts photos with both coordinates', () => {
		expect(locatedCount([taipei, noGps, { lat: 1, lon: null }])).toBe(1);
	});
});
