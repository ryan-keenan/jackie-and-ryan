import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import { parseBody, referencedVideoIds } from '../../../../lib/blocks';
import {
	deleteVideoRow,
	getPhotosForAdmin,
	getPostForAdmin,
	getVideo,
	getVideosForPost,
	updateVideoStatus,
	updateVideoText,
} from '../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../lib/http';
import { deleteStreamVideo, getVideoStatus, readStreamConfig } from '../../../../lib/stream';

function streamConfig() {
	try {
		return readStreamConfig(env);
	} catch (error) {
		throw new BadRequest((error as Error).message, 500);
	}
}

/** The video's current state. While Stream is still processing, asks Stream for an update first. */
export const GET: APIRoute = ({ params }) =>
	handle(async () => {
		const video = await getVideo(params.id!);
		if (!video) throw new BadRequest('Video not found', 404);
		if (video.status === 'processing') {
			const status = await getVideoStatus(streamConfig(), video.stream_uid);
			if (status.state !== 'processing') {
				await updateVideoStatus(video.id, {
					status: status.state,
					error: status.error,
					playback_host: status.playbackHost,
					duration: status.duration,
					width: status.width,
					height: status.height,
				});
			}
		}
		return json(await getVideo(video.id));
	});

const actionSchema = z.object({ action: z.literal('uploaded') }).strict();

/** Called by the browser when the upload to Stream finishes; Stream then encodes the video. */
export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		parseWith(actionSchema, await readJson(request));
		const video = await getVideo(params.id!);
		if (!video) throw new BadRequest('Video not found', 404);
		if (video.status === 'uploading') await updateVideoStatus(video.id, { status: 'processing' });
		return json(await getVideo(video.id));
	});

const textSchema = z
	.object({ note: z.string().trim().max(500), caption: z.string().trim().max(500) })
	.partial()
	.strict();

export const PATCH: APIRoute = ({ params, request }) =>
	handle(async () => {
		const text = parseWith(textSchema, await readJson(request));
		if (!(await updateVideoText(params.id!, text))) throw new BadRequest('Video not found', 404);
		return json({ ok: true });
	});

export const DELETE: APIRoute = ({ params }) =>
	handle(async () => {
		const video = await getVideo(params.id!);
		if (!video) throw new BadRequest('Video not found', 404);

		const post = await getPostForAdmin(video.post_id);
		const photoIds = (await getPhotosForAdmin(video.post_id)).map((p) => p.id);
		const videoIds = (await getVideosForPost(video.post_id)).map((v) => v.id);
		if (referencedVideoIds(parseBody(post!.body, photoIds, videoIds)).includes(video.id)) {
			throw new BadRequest('This video is used in the post. Remove it from the post before deleting it.', 409);
		}

		await deleteStreamVideo(streamConfig(), video.stream_uid);
		await deleteVideoRow(video);
		return json({ ok: true });
	});
