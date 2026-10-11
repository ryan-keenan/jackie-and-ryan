import Anthropic from '@anthropic-ai/sdk';
import { env } from 'cloudflare:workers';
import {
	getJob,
	getPhotosForAdmin,
	getPostForAdmin,
	recentPublishedBodies,
	saveDraft,
	updateJob,
} from '../db';
import { DraftFailed, generateDraft, isRetryable, readDraftConfig } from './draft';

// Runs one drafting job from the queue. Called by the queue consumer in
// src/worker.ts, which retries the message when this returns 'retry'.

export interface DraftJobMessage {
	jobId: string;
}

/** Attempts per job, counting the first; matches max_retries + 1 in wrangler.jsonc. */
export const MAX_ATTEMPTS = 3;

const EXAMPLE_POSTS = 2;

export async function runDraftJob(jobId: string, attempt: number): Promise<'done' | 'retry'> {
	const job = await getJob(jobId);
	if (!job) throw new Error(`Drafting job ${jobId} not found`);
	if (job.status === 'succeeded' || job.status === 'failed') return 'done';

	await updateJob(jobId, { status: 'running' });
	try {
		const config = readDraftConfig(env);
		const post = await getPostForAdmin(job.post_id);
		if (!post) throw new DraftFailed('The post was deleted');

		const photos = await getPhotosForAdmin(post.id);
		const missingAiCopy = photos.filter((photo) => !photo.r2_key_ai);
		if (missingAiCopy.length > 0) {
			throw new DraftFailed(
				`${missingAiCopy.length} photo(s) were uploaded before AI drafting existed and have no AI-sized copy. Delete and re-upload them.`,
			);
		}

		const images = new Map<string, Uint8Array>();
		await Promise.all(
			photos.map(async (photo) => {
				const object = await env.PHOTOS.get(photo.r2_key_ai!);
				if (!object) throw new Error(`Photo ${photo.r2_key_ai} is in the database but missing from R2`);
				images.set(photo.id, new Uint8Array(await object.arrayBuffer()));
			}),
		);
		const examples = await recentPublishedBodies(post.id, EXAMPLE_POSTS);

		const client = new Anthropic({ apiKey: config.apiKey });
		const result = await generateDraft(client, config, { post, photos, images, examples });

		await saveDraft(post.id, {
			title: result.draft.title,
			summary: result.draft.summary,
			coverPhotoId: result.draft.coverPhotoId,
			body: JSON.stringify(result.draft.body),
			captions: result.draft.captions,
		});
		await updateJob(jobId, {
			status: 'succeeded',
			model: result.model,
			input_tokens: result.inputTokens,
			output_tokens: result.outputTokens,
		});
		return 'done';
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (isRetryable(error) && attempt < MAX_ATTEMPTS) {
			console.warn(`Drafting job ${jobId} attempt ${attempt} failed, will retry: ${message}`);
			await updateJob(jobId, { status: 'queued', error: `Attempt ${attempt} failed (${message}); retrying.` });
			return 'retry';
		}
		console.error(`Drafting job ${jobId} failed: ${message}`);
		await updateJob(jobId, { status: 'failed', error: message });
		return 'done';
	}
}
