import { describe, expect, it } from 'vitest';
import { isRetryableResearchError, readResearchConfig, toResearchItems } from './research';
import { researchRequestText } from './research-prompt';

describe('readResearchConfig', () => {
	it('reads the chosen service and fails loudly on missing settings', () => {
		const env = { ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: ' g ', RESEARCH_CLAUDE_MODEL: 'claude-sonnet-5-5', RESEARCH_GEMINI_MODEL: 'gemini-4-argon' };
		expect(readResearchConfig('gemini', env)).toEqual({ provider: 'gemini', apiKey: 'g', model: 'gemini-4-argon' });
		expect(() => readResearchConfig('gemini', { ...env, GEMINI_API_KEY: '' })).toThrow(/GEMINI_API_KEY/);
		expect(() => readResearchConfig('claude', { ...env, RESEARCH_CLAUDE_MODEL: undefined })).toThrow(/RESEARCH_CLAUDE_MODEL/);
	});
});

describe('toResearchItems', () => {
	const seen = new Map([['https://en.wikipedia.org/wiki/Eagle_Lake', 'Eagle Lake - Wikipedia']]);

	it('marks sources found in the search results as verified and others not', () => {
		const [item] = toResearchItems(
			{
				place_researched: 'Eagle Lake',
				items: [{ text: ' A lake. ', source_urls: ['https://en.wikipedia.org/wiki/Eagle_Lake/', 'https://www.example.com/x', 'not a url', 'javascript:alert(1)'] }],
			},
			seen,
		);
		expect(item.text).toBe('A lake.');
		expect(item.sources).toEqual([
			{ url: 'https://en.wikipedia.org/wiki/Eagle_Lake/', title: 'Eagle Lake - Wikipedia', verified: true },
			{ url: 'https://www.example.com/x', title: 'example.com', verified: false },
		]);
		expect(item.id).toBeTruthy();
	});

	it('drops empty items', () => {
		expect(toResearchItems({ place_researched: '', items: [{ text: '  ', source_urls: [] }] }, seen)).toEqual([]);
	});
});

describe('researchRequestText', () => {
	it('includes the trip, coordinates, notes and non-empty photo notes', () => {
		const text = researchRequestText({
			workingTitle: 'Eagle Lake',
			location: 'Eagle Lake, CA',
			placeName: 'Eagle Lake, El Dorado County',
			coordinates: { lat: 38.94215, lon: -120.12235 },
			tripStart: '2026-09-17',
			tripEnd: '2026-09-17',
			notes: 'climbed',
			photoNotes: ['scared', ' '],
		});
		expect(text).toContain('Approximate coordinates: 38.942, -120.122');
		expect(text).toContain('Dates: 2026-09-17\n');
		expect(text).toContain('- scared');
		expect(text).not.toContain('- \n');
	});
});

describe('isRetryableResearchError', () => {
	it('retries rate limits, server errors and connection failures only', () => {
		expect(isRetryableResearchError(Object.assign(new Error('busy'), { status: 429 }))).toBe(true);
		expect(isRetryableResearchError(Object.assign(new Error('down'), { status: 503 }))).toBe(true);
		expect(isRetryableResearchError(Object.assign(new Error('bad'), { status: 400 }))).toBe(false);
		expect(isRetryableResearchError(Object.assign(new Error('net'), { name: 'ConnectionError' }))).toBe(true);
		expect(isRetryableResearchError(new Error('other'))).toBe(false);
	});
});
