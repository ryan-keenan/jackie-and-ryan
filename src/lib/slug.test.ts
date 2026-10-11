import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
	it('makes readable URL slugs', () => {
		expect(slugify("Taiwan & Seoul, Jan '26")).toBe('taiwan-seoul-jan-26');
		expect(slugify('  Café crème — Paris  ')).toBe('cafe-creme-paris');
	});

	it('falls back to "post" when nothing usable is left', () => {
		expect(slugify('台北')).toBe('post');
		expect(slugify('!!!')).toBe('post');
	});

	it('caps the length without a trailing dash', () => {
		const slug = slugify('a '.repeat(100));
		expect(slug.length).toBeLessThanOrEqual(60);
		expect(slug.endsWith('-')).toBe(false);
	});
});

describe('uniqueSlug', () => {
	it('appends -2, -3, ... until the slug is free', async () => {
		const taken = new Set(['taiwan', 'taiwan-2']);
		expect(await uniqueSlug('taiwan', async (s) => taken.has(s))).toBe('taiwan-3');
		expect(await uniqueSlug('seoul', async (s) => taken.has(s))).toBe('seoul');
	});
});
