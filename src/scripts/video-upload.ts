import { Upload } from 'tus-js-client';
import type { VideoRow } from '../lib/db';

// Uploads a video straight from the browser to Cloudflare Stream with the tus
// resumable protocol. The Worker creates the upload (POST .../videos/tus) and
// answers with Stream's one-time upload URL; the file's chunks then go to
// Stream directly, so large files never pass through the Worker.

export type VideoState = Pick<
	VideoRow,
	'id' | 'status' | 'error' | 'playback_host' | 'stream_uid' | 'duration' | 'file_name'
>;

/** Stream requires chunks of at least 5 MB in multiples of 256 KiB; 50 MB is its recommendation. */
const CHUNK_BYTES = 50 * 1024 * 1024;

export function uploadVideo(
	postId: string,
	file: File,
	callbacks: { onCreated: (videoId: string) => void; onProgress: (fraction: number) => void },
): Promise<VideoState> {
	let videoId: string | null = null;

	return new Promise((resolve, reject) => {
		const upload = new Upload(file, {
			endpoint: `/api/admin/posts/${postId}/videos/tus`,
			chunkSize: CHUNK_BYTES,
			retryDelays: [0, 3000, 10000, 30000],
			metadata: { name: file.name },
			// Each upload gets its own database row when created, so resuming an
			// old upload from a previous visit would skip that step.
			storeFingerprintForResuming: false,
			onAfterResponse: (request, response) => {
				if (request.getMethod() === 'POST' && !videoId) {
					videoId = response.getHeader('X-Video-Id') ?? null;
					if (videoId) callbacks.onCreated(videoId);
				}
			},
			onProgress: (sent, total) => callbacks.onProgress(total ? sent / total : 0),
			onError: (error) => {
				// The Worker returns JSON errors (e.g. file too large); show those instead of tus internals.
				const body = (error as { originalResponse?: { getBody(): string } }).originalResponse?.getBody();
				try {
					const message = body ? (JSON.parse(body) as { error?: string }).error : undefined;
					reject(new Error(message ?? error.message));
				} catch {
					reject(error);
				}
			},
			onSuccess: async () => {
				if (!videoId) return reject(new Error('The server did not return a video id'));
				const response = await fetch(`/api/admin/videos/${videoId}`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ action: 'uploaded' }),
				});
				if (!response.ok) return reject(new Error(`Could not mark the upload finished (HTTP ${response.status})`));
				resolve((await response.json()) as VideoState);
			},
		});
		upload.start();
	});
}
