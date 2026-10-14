import { describe, expect, it, vi } from 'vitest';
import { GeocodeFailed, geocodePlace, placeQueries } from './geocode';

function reply(results: unknown[], status = 200) {
	return new Response(JSON.stringify(results), { status });
}

describe('placeQueries', () => {
	it('tries the full text, then drops leading parts', () => {
		expect(placeQueries('Black Wall, Donner Summit, CA')).toEqual(['Black Wall, Donner Summit, CA', 'Donner Summit, CA', 'CA']);
		expect(placeQueries('  ')).toEqual([]);
	});
});

describe('geocodePlace', () => {
	it('returns the first match, falling back to less specific queries', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(reply([]))
			.mockResolvedValueOnce(reply([{ lat: '39.34', lon: '-120.34', display_name: 'Donner Summit, California' }]));
		expect(await geocodePlace('Black Wall, Donner Summit', fetchFn)).toEqual({
			lat: 39.34,
			lon: -120.34,
			name: 'Donner Summit, California',
		});
		expect(fetchFn.mock.calls[1][0]).toContain('q=Donner+Summit');
		expect(fetchFn.mock.calls[0][1].headers['user-agent']).toMatch(/jackieandryan/);
	});

	it('returns null when nothing matches and throws when the service fails', async () => {
		expect(await geocodePlace('Nowhere', vi.fn().mockResolvedValue(reply([])))).toBeNull();
		await expect(geocodePlace('Squamish', vi.fn().mockResolvedValue(reply([], 503)))).rejects.toBeInstanceOf(GeocodeFailed);
	});
});
