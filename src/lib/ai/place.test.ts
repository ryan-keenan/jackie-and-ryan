import { describe, expect, it } from 'vitest';
import { PlaceFailed, placeRequestPost, readPlaceConfig, toSuggestion, type PlaceOutput } from './place';
import { placeRequestText } from './place-prompt';

describe('toSuggestion', () => {
	const output: PlaceOutput = {
		label: ' Black Velvet Peak ',
		latitude: 36.0389,
		longitude: -115.4776,
		source_url: 'https://www.peakbagger.com/peak.aspx?pid=1234#map',
		search: 'Black Velvet Peak, Nevada, USA',
		confident: true,
		reason: 'Peakbagger lists the summit.',
	};

	it('takes the coordinates and marks the source verified when the search returned it', () => {
		const seen = new Set(['https://www.peakbagger.com/peak.aspx?pid=1234']);
		expect(toSuggestion(output, seen, 2)).toEqual({
			label: 'Black Velvet Peak',
			coordinates: { lat: 36.0389, lon: -115.4776, source: { url: 'https://www.peakbagger.com/peak.aspx?pid=1234#map', verified: true } },
			search: 'Black Velvet Peak, Nevada, USA',
			confident: true,
			reason: 'Peakbagger lists the summit.',
			webSearches: 2,
		});
		expect(toSuggestion(output, new Set(), 2).coordinates?.source?.verified).toBe(false);
	});

	it('falls back to the map search without coordinates, and fails with neither', () => {
		const none = { ...output, latitude: null, longitude: null, source_url: '' };
		expect(toSuggestion(none, new Set(), 1).coordinates).toBeNull();
		expect(() => toSuggestion({ ...none, search: ' ' }, new Set(), 1)).toThrow(PlaceFailed);
		expect(() => toSuggestion({ ...output, label: '' }, new Set(), 1)).toThrow(/did not name a place/);
	});
});

describe('placeRequestText', () => {
	it('sends the request, details, notes, photo and video notes, captions and post text', () => {
		const post = placeRequestPost(
			{ title: 'Epinephrine', location: '', trip_start: '2026-10-10', trip_end: null },
			'Topped out in the dark.',
			[{ note: 'the chimneys', caption: 'Still smiling' }, { note: '', caption: '' }],
			[{ note: 'rappel', caption: 'Going down' }],
			[
				{ type: 'heading', text: 'Black Velvet' },
				{ type: 'paragraph', markdown: 'An epic day.' },
				{ type: 'photo', photoId: 'p1' },
				{ type: 'quote', text: 'Never again', attribution: 'Jackie' },
			],
			'Black Velvet Peak',
		);
		const text = placeRequestText(post);
		expect(text.startsWith('<request>\nBlack Velvet Peak\n</request>')).toBe(true);
		expect(text).toContain('Find the place the request names.');
		expect(placeRequestText({ ...post, request: '' })).not.toContain('<request>');
		expect(text).toContain('Title: Epinephrine\nLocation: not given\nDates: 2026-10-10');
		expect(text).toContain('<notes>\nTopped out in the dark.\n</notes>');
		expect(text).toContain('<photo_notes>\n- the chimneys\n- rappel\n</photo_notes>');
		expect(text).toContain('<captions>\n- Still smiling\n- Going down\n</captions>');
		expect(text).toContain('<post_text>\nBlack Velvet\nAn epic day.\n"Never again" (Jackie)\n</post_text>');
	});
});

describe('readPlaceConfig', () => {
	it('fails when the key or model is missing', () => {
		expect(() => readPlaceConfig({ PLACE_MODEL: 'claude-sonnet-5-5' })).toThrow(/ANTHROPIC_API_KEY/);
		expect(() => readPlaceConfig({ ANTHROPIC_API_KEY: 'k' })).toThrow(/PLACE_MODEL/);
	});
});
