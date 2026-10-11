import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { readDraftConfig } from '../../../../../lib/ai/draft';
import type { DraftJobMessage } from '../../../../../lib/ai/job';
import { createJob, getPhotosForAdmin, getPostForAdmin, latestJobForPost } from '../../../../../lib/db';
import { BadRequest, handle, json } from '../../../../../lib/http';

/** Starts an AI drafting job for the post. The page polls /api/admin/jobs/:id for the result. */
export const POST: APIRoute = ({ params }) =>
	handle(async () => {
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);

		let model: string;
		try {
			model = readDraftConfig(env).model;
		} catch (error) {
			throw new BadRequest((error as Error).message, 500);
		}

		if ((await getPhotosForAdmin(post.id)).length === 0) {
			throw new BadRequest('Add at least one photo before generating a draft');
		}
		const latest = await latestJobForPost(post.id);
		if (latest && (latest.status === 'queued' || latest.status === 'running')) {
			throw new BadRequest('A draft is already being written for this post', 409);
		}

		const jobId = crypto.randomUUID();
		await createJob({ id: jobId, postId: post.id, model });
		await env.DRAFT_QUEUE.send({ jobId } satisfies DraftJobMessage);
		return json({ id: jobId, status: 'queued' }, 202);
	});
