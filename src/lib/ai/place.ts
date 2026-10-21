import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { z } from 'astro/zod';
import type { Block } from '../blocks';
import { PLACE_SYSTEM_PROMPT, placeRequestText, type PlaceRequestPost } from './place-prompt';

// Works out the one place a post is about, for its map pin, from what is written
// about it (no photos are sent). Claude can search the web for names it doesn't
// know, and answers in structured JSON.

/** Upper bound on searches per run; most posts need none. */
const MAX_SEARCHES = 3;
/** Times a paused turn (stop_reason "pause_turn") is resumed before giving up. */
const MAX_CONTINUATIONS = 3;

export const placeOutputSchema = z.object({
	label: z.string().describe('The place name for the map, short, e.g. "Black Velvet Canyon"'),
	search: z.string().describe('Map search text: name, state or province, country, e.g. "Black Velvet Canyon, Nevada, USA"'),
	confident: z.boolean().describe('Whether the post makes the place clear'),
	reason: z.string().describe('One sentence on how the place was worked out'),
});

export interface PlaceConfig {
	apiKey: string;
	model: string;
}

/** Reads the settings. Missing settings fail with a message naming them. */
export function readPlaceConfig(env: { ANTHROPIC_API_KEY?: string; PLACE_MODEL?: string }): PlaceConfig {
	const missing = (['ANTHROPIC_API_KEY', 'PLACE_MODEL'] as const).filter((name) => !env[name]?.trim());
	if (missing.length > 0) throw new Error(`Finding the place is not configured: missing ${missing.join(', ')}`);
	return { apiKey: env.ANTHROPIC_API_KEY!.trim(), model: env.PLACE_MODEL!.trim() };
}

/** A failure that retrying won't fix: a refusal or an unusable reply. */
export class PlaceFailed extends Error {}

export interface PlaceSuggestion {
	/** Text for the post's map pin field: the label, then the rest of the map search. */
	pin: string;
	confident: boolean;
	reason: string;
	webSearches: number;
}

/**
 * The map pin text: the search text, led by the label so the pin shows the
 * label (the pin's label is the text up to the first comma).
 */
export function pinText(label: string, search: string): string {
	const name = label.trim();
	const parts = search.split(',').map((part) => part.trim()).filter(Boolean);
	if (!name) return parts.join(', ');
	if (parts[0]?.toLowerCase() === name.toLowerCase()) parts.shift();
	return [name, ...parts].join(', ');
}

/** What the prompt gets from a post: its details, notes, captions and text. */
export function placeRequestPost(
	post: { title: string; location: string; trip_start: string | null; trip_end: string | null },
	notes: string,
	photos: { note: string; caption: string }[],
	videos: { note: string; caption: string }[],
	blocks: Block[],
): PlaceRequestPost {
	const text: string[] = [];
	for (const block of blocks) {
		if (block.type === 'heading') text.push(block.text);
		else if (block.type === 'paragraph') text.push(block.markdown);
		else if (block.type === 'quote') text.push(`"${block.text}"${block.attribution ? ` (${block.attribution})` : ''}`);
	}
	return {
		title: post.title,
		location: post.location,
		tripStart: post.trip_start,
		tripEnd: post.trip_end,
		notes,
		photoNotes: [...photos.map((photo) => photo.note), ...videos.map((video) => video.note)],
		captions: [...photos.map((photo) => photo.caption), ...videos.map((video) => video.caption)],
		text,
	};
}

export async function findPlace(config: PlaceConfig, post: PlaceRequestPost): Promise<PlaceSuggestion> {
	const client = new Anthropic({ apiKey: config.apiKey });
	const messages: BetaMessageParam[] = [{ role: 'user', content: placeRequestText(post) }];
	let webSearches = 0;

	for (let turn = 0; ; turn++) {
		const response = await client.beta.messages.parse({
			model: config.model,
			max_tokens: 4000,
			system: PLACE_SYSTEM_PROMPT,
			tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: MAX_SEARCHES }],
			output_config: { effort: 'medium', format: betaZodOutputFormat(placeOutputSchema) },
			messages,
		});
		webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;

		// A search turn can pause; sending it back unchanged lets it continue.
		if (response.stop_reason === 'pause_turn') {
			if (turn >= MAX_CONTINUATIONS) throw new PlaceFailed('Finding the place took too many rounds of searching. Try again.');
			messages.push({ role: 'assistant', content: response.content as BetaMessageParam['content'] });
			continue;
		}
		if (response.stop_reason === 'refusal') {
			throw new PlaceFailed(`Claude declined to find the place (category: ${response.stop_details?.category ?? 'unspecified'}).`);
		}
		if (response.stop_reason === 'max_tokens') throw new PlaceFailed('The reply was cut off before it named a place.');
		const output = response.parsed_output;
		if (!output) throw new PlaceFailed('Claude returned a place that could not be read');
		const pin = pinText(output.label, output.search);
		if (!pin) throw new PlaceFailed('Claude did not name a place');
		return { pin, confident: output.confident, reason: output.reason.trim(), webSearches };
	}
}
