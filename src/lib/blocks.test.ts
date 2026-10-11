import { describe, expect, it } from 'vitest';
import { parseBody, referencedPhotoIds, type Block } from './blocks';

const body: Block[] = [
	{ type: 'paragraph', markdown: 'Hello' },
	{ type: 'photo', photoId: 'a' },
	{ type: 'gallery', photoIds: ['b', 'c', 'a'] },
	{ type: 'heading', text: 'Day 2' },
	{ type: 'quote', text: 'Worth it', attribution: 'Jackie' },
];

describe('parseBody', () => {
	it('accepts a valid body whose photos all belong to the post', () => {
		expect(parseBody(JSON.stringify(body), ['a', 'b', 'c'])).toEqual(body);
	});

	it('rejects a body that references a photo not attached to the post', () => {
		expect(() => parseBody(JSON.stringify(body), ['a', 'b'])).toThrow(/not attached to the post: c/);
	});

	it('rejects unknown block types', () => {
		expect(() => parseBody(JSON.stringify([{ type: 'video', url: 'x' }]), [])).toThrow();
	});

	it('rejects empty text and galleries outside 2-6 photos', () => {
		expect(() => parseBody(JSON.stringify([{ type: 'paragraph', markdown: '' }]), [])).toThrow();
		expect(() => parseBody(JSON.stringify([{ type: 'gallery', photoIds: ['a'] }]), ['a'])).toThrow();
		const seven = ['1', '2', '3', '4', '5', '6', '7'];
		expect(() => parseBody(JSON.stringify([{ type: 'gallery', photoIds: seven }]), seven)).toThrow();
	});

	it('rejects a body that is not a JSON array', () => {
		expect(() => parseBody('{"type":"heading","text":"x"}', [])).toThrow();
		expect(() => parseBody('not json', [])).toThrow();
	});
});

describe('referencedPhotoIds', () => {
	it('lists each photo once, in order of first appearance', () => {
		expect(referencedPhotoIds(body)).toEqual(['a', 'b', 'c']);
	});
});
