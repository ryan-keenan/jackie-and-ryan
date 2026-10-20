import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { AdminPhoto, AdminPost, VideoRow } from '../db';
import { buildDraftContent, DraftFailed, generateDraft, MAX_DRAFT_PHOTOS, readDraftConfig, type DraftInput } from './draft';
import { DRAFT_SYSTEM_PROMPT } from './prompt';
import { convertDraft, type DraftOutput } from './schema';

const post = {
	id: 'post-1',
	title: 'Taiwan',
	location: 'Taipei',
	trip_start: '2026-01-10',
	trip_end: '2026-01-12',
	author_notes: 'Night market on day one.',
} as AdminPost;

function photo(id: string, extra: Partial<AdminPhoto> = {}): AdminPhoto {
	return { id, taken_at: '2026-01-10T19:32:00+08:00', lat: 25.0339, lon: 121.5645, note: '', ...extra } as AdminPhoto;
}

function input(count = 3): DraftInput {
	const photos = Array.from({ length: count }, (_, i) => photo(`id-${i + 1}`));
	return {
		post,
		photos,
		images: new Map(photos.map((p) => [p.id, new Uint8Array([0xff, 0xd8, 0xff])])),
	};
}

const goodOutput: DraftOutput = {
	title: 'Two nights in Taipei',
	summary: 'Dumplings, rain and a lot of stairs.',
	cover_photo: 'P2',
	blocks: [
		{ type: 'paragraph', markdown: 'We landed late.' },
		{ type: 'photo', photo: 'P1' },
		{ type: 'gallery', photos: ['P2', 'p3'] },
		{ type: 'quote', text: 'More dumplings.', attribution: '' },
	],
	photo_captions: [{ photo: 'P1', caption: 'Arrival', alt: 'A rainy street at night' }],
	video_captions: [],
};

function fakeClient(response: Record<string, unknown>) {
	const parse = vi.fn().mockResolvedValue({
		stop_reason: 'end_turn',
		stop_details: null,
		model: 'claude-sonnet-5-5',
		usage: { input_tokens: 9000, output_tokens: 1200 },
		parsed_output: goodOutput,
		...response,
	});
	return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const config = { apiKey: 'test-key', model: 'claude-sonnet-5-5' };

describe('convertDraft', () => {
	const labels = new Map([
		['P1', 'id-1'],
		['P2', 'id-2'],
		['P3', 'id-3'],
	]);

	it('maps photo labels to ids, case-insensitively, and drops empty attributions', () => {
		const draft = convertDraft(goodOutput, labels);
		expect(draft.coverPhotoId).toBe('id-2');
		expect(draft.body).toEqual([
			{ type: 'paragraph', markdown: 'We landed late.' },
			{ type: 'photo', photoId: 'id-1' },
			{ type: 'gallery', photoIds: ['id-2', 'id-3'] },
			{ type: 'quote', text: 'More dumplings.' },
		]);
		expect(draft.captions).toEqual([{ photoId: 'id-1', caption: 'Arrival', alt: 'A rainy street at night' }]);
	});

	it('rejects unknown photo labels, bad galleries, duplicates and empty drafts', () => {
		expect(() => convertDraft({ ...goodOutput, cover_photo: 'P9' }, labels)).toThrow(/unknown photo "P9"/);
		expect(() =>
			convertDraft({ ...goodOutput, blocks: [{ type: 'gallery', photos: ['P1'] }] }, labels),
		).toThrow(/Block 1/);
		expect(() =>
			convertDraft(
				{ ...goodOutput, blocks: [{ type: 'photo', photo: 'P1' }, { type: 'photo', photo: 'P1' }] },
				labels,
			),
		).toThrow(/more than once/);
		expect(() => convertDraft({ ...goodOutput, blocks: [] }, labels)).toThrow(/no content/);
	});
});

describe('convertDraft with videos', () => {
	const photos = new Map([['P1', 'id-1']]);
	const videos = new Map([['V1', 'vid-1']]);
	const withVideo: DraftOutput = {
		...goodOutput,
		cover_photo: 'P1',
		blocks: [{ type: 'video', video: 'v1' }, { type: 'photo', photo: 'P1' }],
		video_captions: [{ video: 'V1', caption: 'Climbing' }],
	};

	it('maps video labels and captions', () => {
		const draft = convertDraft(withVideo, photos, videos);
		expect(draft.body[0]).toEqual({ type: 'video', videoId: 'vid-1' });
		expect(draft.videoCaptions).toEqual([{ videoId: 'vid-1', caption: 'Climbing' }]);
	});

	it('rejects unknown and repeated videos', () => {
		expect(() => convertDraft({ ...withVideo, blocks: [{ type: 'video', video: 'V2' }] }, photos, videos)).toThrow(/unknown video "V2"/);
		expect(() =>
			convertDraft({ ...withVideo, blocks: [{ type: 'video', video: 'V1' }, { type: 'video', video: 'V1' }] }, photos, videos),
		).toThrow(/video appears more than once/);
	});
});

describe('buildDraftContent', () => {
	it('introduces each photo with a label, time, location and note, then ends with the trip text', () => {
		const data = input(2);
		data.photos[1].note = 'the hut we slept in';
		const content = buildDraftContent(data);
		expect(content.map((block) => block.type)).toEqual(['text', 'image', 'text', 'image', 'text']);
		expect(content[0]).toMatchObject({ text: 'Photo P1, taken 2026-01-10T19:32:00+08:00, location 25.0339, 121.5645.' });
		expect(content[2]).toMatchObject({ text: expect.stringContaining('Their note: "the hut we slept in"') });
		expect(content[1]).toMatchObject({ source: { type: 'base64', media_type: 'image/jpeg', data: '/9j/' } });
		const last = content[4] as { text: string };
		expect(last.text).toContain('Night market on day one.');
		expect(last.text).toContain('Dates: 2026-01-10 to 2026-01-12');
		expect(last.text).not.toContain('<research>');
	});

	it('adds reviewed research, labeled R1, R2, before the request', () => {
		const data = { ...input(1), research: [{ id: 'a', text: 'Named for eagles.', sources: [] }, { id: 'b', text: 'Popular hike.', sources: [] }] };
		const content = buildDraftContent(data);
		const last = content.at(-1) as { text: string };
		expect(last.text).toContain('<research>\nR1: Named for eagles.\nR2: Popular hike.\n</research>\n\nWrite the post.');
	});

	it('adds each video as an introduction and a still frame after the photos', () => {
		const data = input(1);
		data.videos = [{ video: { id: 'vid-1', duration: 42.4, note: 'Jackie on the crux' } as VideoRow, still: new Uint8Array([0xff, 0xd8, 0xff]) }];
		const content = buildDraftContent(data);
		expect(content.map((block) => block.type)).toEqual(['text', 'image', 'text', 'image', 'text']);
		expect(content[2]).toMatchObject({ text: 'Video V1, 0:42 long, still frame below. Their note: "Jackie on the crux"' });
	});
});

describe('generateDraft', () => {
	it('sends the system prompt, model, effort and fallback, and returns the converted draft', async () => {
		const { client, parse } = fakeClient({});
		const result = await generateDraft(client, config, input());
		const request = parse.mock.calls[0][0];
		expect(request.model).toBe('claude-sonnet-5-5');
		expect(request.system).toBe(DRAFT_SYSTEM_PROMPT);
		expect(request.fallbacks).toBe('default');
		expect(request.betas).toEqual(['server-side-fallback-2026-07-01']);
		expect(request.output_config.effort).toBe('medium');
		expect(request.output_config.format).toBeDefined();
		expect(result.draft.title).toBe('Two nights in Taipei');
		expect(result.inputTokens).toBe(9000);
	});

	it('fails clearly on refusals, cut-off replies and unreadable output', async () => {
		await expect(
			generateDraft(fakeClient({ stop_reason: 'refusal', stop_details: { category: 'general_harms' } }).client, config, input()),
		).rejects.toThrow(/declined.*general_harms/);
		await expect(generateDraft(fakeClient({ stop_reason: 'max_tokens' }).client, config, input())).rejects.toThrow(/cut off/);
		await expect(generateDraft(fakeClient({ parsed_output: null }).client, config, input())).rejects.toBeInstanceOf(DraftFailed);
	});

	it('refuses posts with no photos or too many, without calling the API', async () => {
		const { client, parse } = fakeClient({});
		await expect(generateDraft(client, config, input(0))).rejects.toThrow(/at least one photo/);
		await expect(generateDraft(client, config, input(MAX_DRAFT_PHOTOS + 1))).rejects.toThrow(/up to 60/);
		expect(parse).not.toHaveBeenCalled();
	});
});

describe('readDraftConfig', () => {
	it('fails loudly when the API key or model is missing', () => {
		expect(() => readDraftConfig({ DRAFT_MODEL: 'claude-sonnet-5-5' })).toThrow(/ANTHROPIC_API_KEY/);
		expect(() => readDraftConfig({ ANTHROPIC_API_KEY: 'k' })).toThrow(/DRAFT_MODEL/);
		expect(readDraftConfig({ ANTHROPIC_API_KEY: ' k ', DRAFT_MODEL: 'claude-sonnet-5-5' })).toEqual({
			apiKey: 'k',
			model: 'claude-sonnet-5-5',
		});
	});
});
