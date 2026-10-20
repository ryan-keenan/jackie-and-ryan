import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { AdminPhoto, AdminPost, VideoRow } from '../db';
import type { ResearchItem } from '../research';
import { formatDuration } from '../format';
import { DRAFT_SYSTEM_PROMPT, draftRequestText, photoIntro, videoIntro } from './prompt';
import { convertDraft, draftOutputSchema, type ConvertedDraft } from './schema';

// Turns a post's photos, videos and notes into a draft with Claude. One request
// carries every photo (its 1568px AI copy), one still frame per video, and the
// notes; structured outputs make the reply match draftOutputSchema.

/** Over this many photos the request risks the API's 32MB size limit; ask the admins to trim. */
export const MAX_DRAFT_PHOTOS = 60;

/**
 * Effort controls how much the model thinks before writing. The model guide
 * suggests `low` for content generation; drafting also has to choose and place
 * photos, so it uses `medium`. Revisit with real posts.
 */
const EFFORT = 'medium' as const;

// Server-side fallback: if Claude Sonnet 5.5's safety classifiers decline a
// request in a category that allows it, the API retries on Claude Sonnet 5.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface DraftConfig {
	apiKey: string;
	model: string;
}

/** Reads drafting settings from Worker vars and secrets. Missing settings are a deploy error. */
export function readDraftConfig(env: { ANTHROPIC_API_KEY?: string; DRAFT_MODEL?: string }): DraftConfig {
	const missing = (['ANTHROPIC_API_KEY', 'DRAFT_MODEL'] as const).filter((name) => !env[name]?.trim());
	if (missing.length > 0) throw new Error(`AI drafting is not configured: missing ${missing.join(', ')}`);
	return { apiKey: env.ANTHROPIC_API_KEY!.trim(), model: env.DRAFT_MODEL!.trim() };
}

/** A failure that retrying won't fix: bad input, an unusable reply, or a refusal. */
export class DraftFailed extends Error {}

export interface DraftInput {
	post: AdminPost;
	/** In the order they should be labeled P1, P2, ...: sort order, then time taken. */
	photos: AdminPhoto[];
	/** JPEG bytes of each photo's AI copy, keyed by photo id. */
	images: Map<string, Uint8Array>;
	/** Ready videos, labeled V1, V2, ... in this order, each with a JPEG still frame. */
	videos?: { video: VideoRow; still: Uint8Array }[];
	/** Reviewed research notes, labeled R1, R2, ... in this order. */
	research?: ResearchItem[];
}

export interface DraftResult {
	draft: ConvertedDraft;
	model: string;
	inputTokens: number;
	outputTokens: number;
}

function toBase64(bytes: Uint8Array): string {
	// Chunked so large images don't overflow the argument limit of String.fromCharCode.
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

export function photoLabel(index: number): string {
	return `P${index + 1}`;
}

export function videoLabel(index: number): string {
	return `V${index + 1}`;
}

/** The user message: each photo introduced by a line of text, then the trip details and notes. */
export function buildDraftContent(input: DraftInput): BetaContentBlockParam[] {
	const content: BetaContentBlockParam[] = [];
	input.photos.forEach((photo, index) => {
		const bytes = input.images.get(photo.id);
		if (!bytes) throw new DraftFailed(`Missing image data for photo ${photoLabel(index)}`);
		content.push({
			type: 'text',
			text: photoIntro({
				label: photoLabel(index),
				takenAt: photo.taken_at,
				lat: photo.lat,
				lon: photo.lon,
				note: photo.note,
			}),
		});
		content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: toBase64(bytes) } });
	});
	(input.videos ?? []).forEach(({ video, still }, index) => {
		content.push({
			type: 'text',
			text: videoIntro({ label: videoLabel(index), length: formatDuration(video.duration), note: video.note }),
		});
		content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: toBase64(still) } });
	});
	content.push({
		type: 'text',
		text: draftRequestText({
			workingTitle: input.post.title,
			location: input.post.location,
			tripStart: input.post.trip_start,
			tripEnd: input.post.trip_end,
			notes: input.post.author_notes,
			research: (input.research ?? []).map((item) => item.text),
		}),
	});
	return content;
}

export async function generateDraft(client: Anthropic, config: DraftConfig, input: DraftInput): Promise<DraftResult> {
	if (input.photos.length === 0) throw new DraftFailed('Add at least one photo before generating a draft');
	if (input.photos.length > MAX_DRAFT_PHOTOS) {
		throw new DraftFailed(
			`This post has ${input.photos.length} photos; drafting handles up to ${MAX_DRAFT_PHOTOS}. Delete some first.`,
		);
	}

	const response = await client.beta.messages.parse({
		model: config.model,
		max_tokens: 16000,
		betas: [FALLBACK_BETA],
		fallbacks: 'default',
		system: DRAFT_SYSTEM_PROMPT,
		output_config: { effort: EFFORT, format: betaZodOutputFormat(draftOutputSchema) },
		messages: [{ role: 'user', content: buildDraftContent(input) }],
	});

	if (response.stop_reason === 'refusal') {
		const category = response.stop_details?.category ?? 'unspecified';
		throw new DraftFailed(`Claude declined to write this draft (safety category: ${category}). Try editing the notes.`);
	}
	if (response.stop_reason === 'max_tokens') {
		throw new DraftFailed('The draft was cut off because it ran too long. Try again or trim the notes.');
	}
	if (!response.parsed_output) throw new DraftFailed('Claude returned a draft that could not be read');

	const labels = new Map(input.photos.map((photo, index) => [photoLabel(index), photo.id]));
	const videoLabels = new Map((input.videos ?? []).map(({ video }, index) => [videoLabel(index), video.id]));
	let draft: ConvertedDraft;
	try {
		draft = convertDraft(response.parsed_output, labels, videoLabels);
	} catch (error) {
		throw new DraftFailed((error as Error).message);
	}
	return {
		draft,
		model: response.model,
		inputTokens: response.usage.input_tokens,
		outputTokens: response.usage.output_tokens,
	};
}

/** True for errors worth retrying later: rate limits, server errors and network failures. */
export function isRetryable(error: unknown): boolean {
	return (
		error instanceof Anthropic.RateLimitError ||
		error instanceof Anthropic.InternalServerError ||
		error instanceof Anthropic.APIConnectionError
	);
}
