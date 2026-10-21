import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { locatedCount, MAP_STYLE_LABELS, MAP_STYLES, mapView, pinLabel } from './map';

const taipei = { lat: 25.033964, lon: 121.564468 };
const longdong = { lat: 25.1103, lon: 121.9221 };
const noGps = { lat: null, lon: null };
const noPlace = { ...noGps, label: '' };
const blackVelvet = { lat: 36.0341460, lon: -115.4483425, label: 'Black Velvet Canyon' };

describe('mapView', () => {
	it('returns nothing when the map is off or there is neither a place nor a photo position', () => {
		expect(mapView('off', [taipei], blackVelvet)).toBeNull();
		expect(mapView('country', [noGps, noGps], noPlace)).toBeNull();
	});

	it('puts one labeled pin on the place, rounded to about 1 km, even when photos have positions', () => {
		const view = mapView('fit', [taipei, longdong], blackVelvet)!;
		expect(view).toEqual({ mode: 'fit', source: 'place', pin: [-115.45, 36.03], label: 'Black Velvet Canyon', zoom: 9.3 });
	});

	it('without a place, puts an unlabeled pin in the middle of the photos', () => {
		const view = mapView('country', [taipei, noGps, longdong], noPlace)!;
		expect(view).toEqual({ mode: 'country', source: 'photos', pin: [121.74, 25.07], label: '', zoom: 4.2 });
	});
});

describe('pinLabel', () => {
	it('is the map pin text, or else the Location, up to the first comma', () => {
		expect(pinLabel('Black Velvet Canyon, Nevada, USA', 'Red Rocks')).toBe('Black Velvet Canyon');
		expect(pinLabel('  ', 'Squamish, British Columbia')).toBe('Squamish');
		expect(pinLabel('', '')).toBe('');
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
