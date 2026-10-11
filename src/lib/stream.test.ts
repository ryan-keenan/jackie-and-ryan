import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createDirectUpload,
	deleteStreamVideo,
	getVideoStatus,
	MAX_VIDEO_SECONDS,
	metadataName,
	playerUrl,
	readStreamConfig,
} from './stream';

const config = { accountId: 'acct', apiToken: 'token' };
const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
	const fetch = vi.fn().mockResolvedValue(response);
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

describe('readStreamConfig', () => {
	it('fails loudly when settings are missing', () => {
		expect(() => readStreamConfig({ CF_ACCOUNT_ID: 'a' })).toThrow(/STREAM_API_TOKEN/);
		expect(readStreamConfig({ CF_ACCOUNT_ID: ' a ', STREAM_API_TOKEN: ' t ' })).toEqual({ accountId: 'a', apiToken: 't' });
	});
});

describe('metadataName', () => {
	it('reads the name from tus Upload-Metadata, including non-ASCII names', () => {
		expect(metadataName(`filetype ${b64('video/quicktime')},name ${b64('Hualien – 日落.MOV')}`)).toBe('Hualien – 日落.MOV');
		expect(metadataName(null)).toBe('');
		expect(metadataName('name !!!notbase64')).toBe('');
	});
});

describe('createDirectUpload', () => {
	it('asks Stream for a tus upload with our own metadata and returns the upload URL and id', async () => {
		const fetch = stubFetch(
			new Response(null, { status: 201, headers: { Location: 'https://upload.example/abc', 'stream-media-id': 'uid123' } }),
		);
		const result = await createDirectUpload(config, { bytes: 1234, name: 'IMG_1.MOV' });
		expect(result).toEqual({ uploadUrl: 'https://upload.example/abc', streamUid: 'uid123' });

		const [url, init] = fetch.mock.calls[0];
		expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/stream?direct_user=true');
		expect(init.headers['Upload-Length']).toBe('1234');
		expect(init.headers['Tus-Resumable']).toBe('1.0.0');
		expect(init.headers.Authorization).toBe('Bearer token');
		expect(init.headers['Upload-Metadata']).toBe(`maxdurationseconds ${b64(String(MAX_VIDEO_SECONDS))},name ${b64('IMG_1.MOV')}`);
	});

	it('fails when Stream refuses or omits the upload URL', async () => {
		stubFetch(new Response('quota exceeded', { status: 400 }));
		await expect(createDirectUpload(config, { bytes: 1, name: '' })).rejects.toThrow(/HTTP 400.*quota exceeded/);
	});
});

describe('getVideoStatus', () => {
	const ok = (result: object) => new Response(JSON.stringify({ success: true, result }), { status: 200 });

	it('reports processing until Stream says the video is ready', async () => {
		stubFetch(ok({ readyToStream: false, status: { state: 'inprogress' } }));
		expect((await getVideoStatus(config, 'uid')).state).toBe('processing');
	});

	it('returns the playback host, length and size once ready', async () => {
		stubFetch(
			ok({
				readyToStream: true,
				status: { state: 'ready' },
				duration: 42.5,
				input: { width: 1080, height: 1920 },
				preview: 'https://customer-xyz.cloudflarestream.com/uid/watch',
			}),
		);
		expect(await getVideoStatus(config, 'uid')).toEqual({
			state: 'ready',
			error: null,
			playbackHost: 'customer-xyz.cloudflarestream.com',
			duration: 42.5,
			width: 1080,
			height: 1920,
		});
	});

	it('passes on Stream processing errors', async () => {
		stubFetch(ok({ readyToStream: false, status: { state: 'error', errorReasonText: 'Unsupported codec' } }));
		expect(await getVideoStatus(config, 'uid')).toMatchObject({ state: 'error', error: 'Unsupported codec' });
	});
});

describe('deleteStreamVideo', () => {
	it('treats an already-deleted video as success', async () => {
		stubFetch(new Response('not found', { status: 404 }));
		await expect(deleteStreamVideo(config, 'uid')).resolves.toBeUndefined();
	});

	it('fails on other errors', async () => {
		stubFetch(new Response('nope', { status: 403 }));
		await expect(deleteStreamVideo(config, 'uid')).rejects.toThrow(/HTTP 403/);
	});
});

describe('playerUrl', () => {
	it('builds the embeddable player URL', () => {
		expect(playerUrl('customer-xyz.cloudflarestream.com', 'uid')).toBe(
			'https://customer-xyz.cloudflarestream.com/uid/iframe?preload=none',
		);
	});
});
