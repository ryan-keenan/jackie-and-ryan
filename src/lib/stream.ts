// Cloudflare Stream API calls: creating direct uploads, checking processing
// status, and deleting videos. Uses an API token with Stream:Edit permission.

export interface StreamConfig {
	accountId: string;
	apiToken: string;
}

/** Reads Stream settings from Worker vars and secrets. Missing settings are a deploy error. */
export function readStreamConfig(env: { CF_ACCOUNT_ID?: string; STREAM_API_TOKEN?: string }): StreamConfig {
	const missing = (['CF_ACCOUNT_ID', 'STREAM_API_TOKEN'] as const).filter((name) => !env[name]?.trim());
	if (missing.length > 0) throw new Error(`Video uploads are not configured: missing ${missing.join(', ')}`);
	return { accountId: env.CF_ACCOUNT_ID!.trim(), apiToken: env.STREAM_API_TOKEN!.trim() };
}

/** Longest video Stream will accept from an upload. Stream reserves this many minutes while uploading. */
export const MAX_VIDEO_SECONDS = 30 * 60;
/** Largest video file accepted, in bytes (Stream allows more; this keeps phone uploads sane). */
export const MAX_VIDEO_BYTES = 4 * 1024 ** 3;

/** Stream refused a request; carries Stream's HTTP status and readable error message. */
export class StreamError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

/** The error messages from a Stream API error body, or the raw text if it isn't JSON. */
async function streamErrorText(response: Response): Promise<string> {
	const text = await response.text();
	try {
		const body = JSON.parse(text) as { errors?: { message: string }[] };
		const messages = body.errors?.map((e) => e.message).filter(Boolean) ?? [];
		if (messages.length) return messages.join('; ');
	} catch {
		// Not JSON; fall through to the raw text.
	}
	return text.slice(0, 300);
}

function apiUrl(config: StreamConfig, path = ''): string {
	return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream${path}`;
}

function base64(text: string): string {
	return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

/** Reads the `name` key from a tus Upload-Metadata header ("key base64,key base64"). */
export function metadataName(header: string | null): string {
	for (const pair of (header ?? '').split(',')) {
		const [key, value] = pair.trim().split(' ');
		if (key === 'name' && value) {
			try {
				return new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0))).slice(0, 200);
			} catch {
				return '';
			}
		}
	}
	return '';
}

/**
 * Starts a resumable (tus) upload that the browser sends straight to Stream.
 * Returns the one-time upload URL and the new video's Stream id.
 */
export async function createDirectUpload(
	config: StreamConfig,
	upload: { bytes: number; name: string },
): Promise<{ uploadUrl: string; streamUid: string }> {
	// Built here rather than forwarded from the browser, so only these settings reach Stream.
	const metadata = [`maxdurationseconds ${base64(String(MAX_VIDEO_SECONDS))}`];
	if (upload.name) metadata.push(`name ${base64(upload.name)}`);

	const response = await fetch(apiUrl(config, '?direct_user=true'), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.apiToken}`,
			'Tus-Resumable': '1.0.0',
			'Upload-Length': String(upload.bytes),
			'Upload-Metadata': metadata.join(','),
		},
	});
	const uploadUrl = response.headers.get('Location');
	const streamUid = response.headers.get('stream-media-id');
	if (!response.ok || !uploadUrl || !streamUid) {
		throw new StreamError(`Stream refused the upload: ${await streamErrorText(response)}`, response.status);
	}
	return { uploadUrl, streamUid };
}

export interface StreamVideoStatus {
	state: 'processing' | 'ready' | 'error';
	error: string | null;
	playbackHost: string | null;
	duration: number | null;
	width: number | null;
	height: number | null;
}

interface StreamVideoResponse {
	success: boolean;
	errors?: { message: string }[];
	result?: {
		readyToStream: boolean;
		status?: { state?: string; errorReasonText?: string };
		duration?: number;
		input?: { width?: number; height?: number };
		preview?: string;
	};
}

export async function getVideoStatus(config: StreamConfig, streamUid: string): Promise<StreamVideoStatus> {
	const response = await fetch(apiUrl(config, `/${streamUid}`), {
		headers: { Authorization: `Bearer ${config.apiToken}` },
	});
	const body = (await response.json()) as StreamVideoResponse;
	if (!response.ok || !body.success || !body.result) {
		throw new Error(`Stream status check failed (HTTP ${response.status}): ${body.errors?.map((e) => e.message).join('; ')}`);
	}
	const video = body.result;
	if (video.status?.state === 'error') {
		return {
			state: 'error',
			error: video.status.errorReasonText || 'Stream could not process this video',
			playbackHost: null,
			duration: null,
			width: null,
			height: null,
		};
	}
	if (!video.readyToStream) {
		return { state: 'processing', error: null, playbackHost: null, duration: null, width: null, height: null };
	}
	return {
		state: 'ready',
		error: null,
		playbackHost: video.preview ? new URL(video.preview).host : null,
		duration: video.duration && video.duration > 0 ? video.duration : null,
		width: video.input?.width && video.input.width > 0 ? video.input.width : null,
		height: video.input?.height && video.input.height > 0 ? video.input.height : null,
	};
}

export async function deleteStreamVideo(config: StreamConfig, streamUid: string): Promise<void> {
	const response = await fetch(apiUrl(config, `/${streamUid}`), {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${config.apiToken}` },
	});
	// 404: already gone from Stream, which is the goal.
	if (!response.ok && response.status !== 404) {
		throw new Error(`Stream delete failed (HTTP ${response.status}): ${(await response.text()).slice(0, 300)}`);
	}
}

/** The embeddable player and a still frame for a ready video. */
export function playerUrl(playbackHost: string, streamUid: string): string {
	return `https://${playbackHost}/${streamUid}/iframe?preload=none`;
}

/** A still frame scaled to fit within maxPx x maxPx, keeping its shape (fit=clip). */
export function thumbnailUrl(playbackHost: string, streamUid: string, maxPx = 1280): string {
	return `https://${playbackHost}/${streamUid}/thumbnails/thumbnail.jpg?width=${maxPx}&height=${maxPx}&fit=clip`;
}
