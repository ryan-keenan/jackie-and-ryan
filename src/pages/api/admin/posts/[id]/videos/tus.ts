import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getPostForAdmin, insertVideo } from '../../../../../../lib/db';
import { BadRequest, handle } from '../../../../../../lib/http';
import { createDirectUpload, MAX_VIDEO_BYTES, metadataName, readStreamConfig, StreamError } from '../../../../../../lib/stream';

// The "create upload" step of the tus protocol, used by tus-js-client in the
// admin page. The Worker asks Stream for a one-time upload URL (the API token
// never reaches the browser) and returns it in the Location header; the browser
// then sends the file's chunks straight to Stream.
export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);

		let config;
		try {
			config = readStreamConfig(env);
		} catch (error) {
			throw new BadRequest((error as Error).message, 500);
		}

		const bytes = Number(request.headers.get('Upload-Length'));
		if (!Number.isInteger(bytes) || bytes <= 0) throw new BadRequest('Missing or invalid Upload-Length');
		if (bytes > MAX_VIDEO_BYTES) {
			throw new BadRequest(`Videos can be at most ${MAX_VIDEO_BYTES / 1024 ** 3} GB`, 413);
		}
		const name = metadataName(request.headers.get('Upload-Metadata'));

		let created;
		try {
			created = await createDirectUpload(config, { bytes, name });
		} catch (error) {
			// Stream's 4xx refusals (e.g. storage quota) go back as-is so the browser shows
			// the message instead of retrying; Stream outages become 502s, which it retries.
			if (error instanceof StreamError) throw new BadRequest(error.message, error.status < 500 ? error.status : 502);
			throw error;
		}
		const { uploadUrl, streamUid } = created;
		const id = crypto.randomUUID();
		await insertVideo({ id, postId: post.id, streamUid, fileName: name });

		return new Response(null, {
			status: 201,
			headers: {
				Location: uploadUrl,
				'Tus-Resumable': '1.0.0',
				'X-Video-Id': id,
				'Access-Control-Expose-Headers': 'Location, X-Video-Id',
			},
		});
	});
