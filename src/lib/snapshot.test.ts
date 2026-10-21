import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PhotoRow, PostRow, VideoRow } from './db';
import { applySnapshot, buildSnapshot, hasUnpublishedEdits, parseSnapshot, publishedMediaIds, snapshotSchema } from './snapshot';

const post = {
	title: 'Epinephrine',
	summary: 'A long day.',
	body: JSON.stringify([{ type: 'photo', photoId: 'p1' }, { type: 'map' }, { type: 'paragraph', markdown: 'Up we went.' }]),
	location: 'Red Rocks',
	trip_start: '2026-10-10',
	trip_end: null,
	cover_photo_id: 'p1',
	map_mode: 'fit',
	map_style: 'light-topo',
	map_pin: 'Black Velvet Peak',
	place_lat: 36.0337,
	place_lon: -115.4699,
} as const;
const photos = [{ id: 'p1', caption: 'Still smiling', alt: 'Two climbers' }];
const videos = [{ id: 'v1', caption: 'Rappelling' }];

describe('buildSnapshot and applySnapshot', () => {
	it('round-trips what readers see, over the current rows', () => {
		const snapshot = buildSnapshot(post, photos, videos);
		const edited = { ...post, title: 'Edited title', body: '[]' };
		const applied = applySnapshot(
			parseSnapshot(JSON.stringify(snapshot)),
			edited as unknown as PostRow,
			[{ id: 'p1', caption: 'new caption', alt: 'new alt' }] as PhotoRow[],
			[{ id: 'v1', caption: 'new' }] as VideoRow[],
		);
		expect(applied.post.title).toBe('Epinephrine');
		expect(JSON.parse(applied.post.body)).toEqual(JSON.parse(post.body));
		expect(applied.photos[0]).toMatchObject({ caption: 'Still smiling', alt: 'Two climbers' });
		expect(applied.videos[0]).toMatchObject({ caption: 'Rappelling' });
	});

	it('fails for a published post with no copy', () => {
		expect(() => parseSnapshot(null)).toThrow(/no published copy/);
	});
});

describe('hasUnpublishedEdits', () => {
	it('ignores key order and notices any change readers would see', () => {
		const published = buildSnapshot(post, photos, videos);
		const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(published).reverse())));
		expect(hasUnpublishedEdits(buildSnapshot(post, photos, videos), snapshotSchema.parse(reordered))).toBe(false);
		expect(hasUnpublishedEdits(buildSnapshot(post, [{ ...photos[0], alt: 'changed' }], videos), published)).toBe(true);
		expect(hasUnpublishedEdits(buildSnapshot({ ...post, map_style: 'satellite' }, photos, videos), published)).toBe(true);
	});
});

describe('publishedMediaIds', () => {
	it('lists the media the live copy shows, and nothing for drafts', () => {
		const published_snapshot = JSON.stringify(buildSnapshot(post, photos, videos));
		expect(publishedMediaIds({ status: 'published', published_snapshot })).toEqual({ photos: ['p1'], videos: [] });
		expect(publishedMediaIds({ status: 'draft', published_snapshot: null })).toEqual({ photos: [], videos: [] });
	});
});

describe('migration 0012', () => {
	it('builds the same fields as buildSnapshot', () => {
		const sql = readFileSync(new URL('../../migrations/0012_published_snapshot.sql', import.meta.url), 'utf8');
		const keys = [...sql.matchAll(/^\t'(\w+)', /gm)].map((m) => m[1]);
		expect(keys.sort()).toEqual(Object.keys(buildSnapshot(post, photos, videos)).sort());
	});
});
