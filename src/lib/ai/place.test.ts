import { describe, expect, it } from 'vitest';
import { pinText, placeRequestPost, readPlaceConfig } from './place';
import { placeRequestText } from './place-prompt';

describe('pinText', () => {
	it('leads with the label so the pin shows it, without repeating it', () => {
		expect(pinText('Black Velvet Canyon', 'Black Velvet Canyon, Nevada, USA')).toBe('Black Velvet Canyon, Nevada, USA');
		expect(pinText('Black Velvet Canyon', 'Nevada, USA')).toBe('Black Velvet Canyon, Nevada, USA');
		expect(pinText('', ' Squamish , British Columbia, Canada')).toBe('Squamish, British Columbia, Canada');
	});
});

describe('placeRequestText', () => {
	it('sends the details, notes, photo and video notes, captions and post text', () => {
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
		);
		const text = placeRequestText(post);
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
