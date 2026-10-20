import Anthropic from '@anthropic-ai/sdk';
import { env } from 'cloudflare:workers';
import {
	getJob,
	getPhotosForAdmin,
	getPostForAdmin,
	getVideosForPost,
	saveDraft,
	saveResearch,
	updateJob,
} from '../db';
import { parseResearch, type Research, type ResearchProvider } from '../research';
import { AI_MAX_PX } from '../photo-meta';
import { thumbnailUrl } from '../stream';
import { DraftFailed, generateDraft, isRetryable, readDraftConfig } from './draft';
import { isRetryableResearchError, readResearchConfig, ResearchFailed, runResearch } from './research';

// Runs one drafting or research job from the queue. Called by the queue
// consumer in src/worker.ts, which retries the message when this returns 'retry'.

export interface DraftJobMessage {
	jobId: string;
}

export interface ResearchJobMessage {
	jobId: string;
	provider: ResearchProvider;
}

export type JobMessage = DraftJobMessage | ResearchJobMessage;

export function runJob(message: JobMessage, attempt: number): Promise<'done' | 'retry'> {
	return 'provider' in message ? runResearchJob(message, attempt) : runDraftJob(message.jobId, attempt);
}

/** Attempts per job, counting the first; matches max_retries + 1 in wrangler.jsonc. */
export const MAX_ATTEMPTS = 3;

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
		// Every video goes to the AI as a still frame. Unfinished or failed videos stop
		// the draft rather than being quietly left out of it.
		const allVideos = await getVideosForPost(post.id);
		const unfinished = allVideos.filter((v) => v.status === 'uploading' || v.status === 'processing');
		if (unfinished.length > 0) {
			throw new DraftFailed(`${unfinished.length} video(s) are still uploading or processing. Wait for them to be ready, then try again.`);
		}
		const failed = allVideos.filter((v) => v.status === 'error');
		if (failed.length > 0) {
			throw new DraftFailed(`${failed.length} video(s) could not be processed by Stream. Delete them, then try again.`);
		}
		const videos = await Promise.all(
			allVideos.map(async (video) => {
				const response = await fetch(thumbnailUrl(video.playback_host!, video.stream_uid, AI_MAX_PX));
				if (!response.ok) throw new Error(`Could not fetch the still frame for video ${video.file_name} (HTTP ${response.status})`);
				return { video, still: new Uint8Array(await response.arrayBuffer()) };
			}),
		);

		// Only research the admins kept reaches the draft; they review it on the post page.
		const research = parseResearch(post.research);

		const client = new Anthropic({ apiKey: config.apiKey });
		const result = await generateDraft(client, config, { post, photos, images, videos, research: research?.items ?? [] });

		await saveDraft(post.id, {
			title: result.draft.title,
			summary: result.draft.summary,
			coverPhotoId: result.draft.coverPhotoId,
			body: JSON.stringify(result.draft.body),
			captions: result.draft.captions,
			videoCaptions: result.draft.videoCaptions,
			sources: JSON.stringify(result.draft.sources),
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

/** Average of the given positions, or null when there are none. */
function centerOf(points: { lat: number | null; lon: number | null }[]): { lat: number; lon: number } | null {
	const located = points.filter((p): p is { lat: number; lon: number } => p.lat !== null && p.lon !== null);
	if (located.length === 0) return null;
	return {
		lat: located.reduce((sum, p) => sum + p.lat, 0) / located.length,
		lon: located.reduce((sum, p) => sum + p.lon, 0) / located.length,
	};
}

export async function runResearchJob(message: ResearchJobMessage, attempt: number): Promise<'done' | 'retry'> {
	const { jobId, provider } = message;
	const job = await getJob(jobId);
	if (!job) throw new Error(`Research job ${jobId} not found`);
	if (job.status === 'succeeded' || job.status === 'failed') return 'done';

	await updateJob(jobId, { status: 'running' });
	try {
		const config = readResearchConfig(provider, env);
		const post = await getPostForAdmin(job.post_id);
		if (!post) throw new ResearchFailed('The post was deleted');
		const photos = await getPhotosForAdmin(post.id);

		const result = await runResearch(config, {
			workingTitle: post.title,
			location: post.location,
			placeName: post.place_name,
			coordinates: centerOf(photos) ?? centerOf([{ lat: post.place_lat, lon: post.place_lon }]),
			tripStart: post.trip_start,
			tripEnd: post.trip_end,
			notes: post.author_notes,
			photoNotes: photos.map((photo) => photo.note),
		});
		if (result.items.length === 0) throw new ResearchFailed('The research found nothing it could source. Try the other service, or a more specific Location.');

		const research: Research = {
			provider,
			model: result.model,
			createdAt: new Date().toISOString(),
			placeResearched: result.placeResearched,
			items: result.items,
			searchSuggestions: result.searchSuggestions,
		};
		await saveResearch(post.id, JSON.stringify(research));
		await updateJob(jobId, {
			status: 'succeeded',
			model: result.model,
			input_tokens: result.inputTokens,
			output_tokens: result.outputTokens,
			web_searches: result.webSearches,
		});
		return 'done';
	} catch (error) {
		const text = error instanceof Error ? error.message : String(error);
		if (isRetryableResearchError(error) && attempt < MAX_ATTEMPTS) {
			console.warn(`Research job ${jobId} attempt ${attempt} failed, will retry: ${text}`);
			await updateJob(jobId, { status: 'queued', error: `Attempt ${attempt} failed (${text}); retrying.` });
			return 'retry';
		}
		console.error(`Research job ${jobId} failed: ${text}`);
		await updateJob(jobId, { status: 'failed', error: text });
		return 'done';
	}
}
