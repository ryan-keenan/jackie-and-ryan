import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { z } from 'astro/zod';
import type { Block } from '../blocks';
import { PLACE_SYSTEM_PROMPT, placeRequestText, type PlaceRequestPost } from './place-prompt';

// Works out the one place a post is about (or the place the admins typed in),
// for its map pin, from what is written about it (no photos are sent). Claude
// searches the web for the place's coordinates, reading a page if the search
// results don't show them, and answers in structured JSON. The pin goes at those
// coordinates, so places OpenStreetMap doesn't know by name can still be pinned.

/** Upper bounds per run on web searches and page reads; keeps cost and time predictable. */
const MAX_SEARCHES = 4;
const MAX_FETCHES = 2;
/** Times a paused turn (stop_reason "pause_turn") is resumed before giving up. */
const MAX_CONTINUATIONS = 3;

export const placeOutputSchema = z.object({
	label: z.string().describe('The place name for the map, short, e.g. "Black Velvet Peak"'),
	latitude: z.number().min(-90).max(90).nullable().describe('Decimal degrees, as a web page gives them; null if no page gives any'),
	longitude: z.number().min(-180).max(180).nullable().describe('Decimal degrees, as a web page gives them; null if no page gives any'),
	source_url: z.string().describe('The page the coordinates came from, or empty'),
	search: z.string().describe('Map search text, used only without coordinates: name, state or province, country'),
	confident: z.boolean().describe('Whether this is surely the right place and the coordinates are for it'),
	reason: z.string().describe('One sentence on how the place was worked out'),
});
export type PlaceOutput = z.infer<typeof placeOutputSchema>;

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
	/** The pin's label. */
	label: string;
	/** Where the coordinates came from: a web page, or null when no page gave any and `search` is to be looked up instead. */
	coordinates: { lat: number; lon: number; source: { url: string; verified: boolean } | null } | null;
	/** Map search text for when there are no coordinates. */
	search: string;
	confident: boolean;
	reason: string;
	webSearches: number;
}

/** Normalizes a URL for comparison: no fragment, no trailing slash. */
function urlKey(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = '';
		return parsed.href.replace(/\/$/, '');
	} catch {
		return url;
	}
}

/** Every page the searches returned or Claude read. */
export function pagesSeen(blocks: BetaContentBlock[]): Set<string> {
	const seen = new Set<string>();
	for (const block of blocks) {
		if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
			for (const result of block.content) seen.add(urlKey(result.url));
		}
		if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') seen.add(urlKey(block.content.url));
	}
	return seen;
}

/**
 * Turns Claude's answer into a suggestion. Coordinates count only as a pair; the
 * source is marked verified when it is a page the searches returned or Claude
 * read, so the admins know whether to check it.
 */
export function toSuggestion(output: PlaceOutput, seen: Set<string>, webSearches: number): PlaceSuggestion {
	const label = output.label.trim();
	if (!label) throw new PlaceFailed('Claude did not name a place');
	let coordinates: PlaceSuggestion['coordinates'] = null;
	if (output.latitude !== null && output.longitude !== null) {
		let source: { url: string; verified: boolean } | null = null;
		try {
			const url = new URL(output.source_url.trim());
			if (url.protocol === 'https:' || url.protocol === 'http:') source = { url: url.href, verified: seen.has(urlKey(url.href)) };
		} catch {
			source = null;
		}
		coordinates = { lat: output.latitude, lon: output.longitude, source };
	}
	const search = output.search.trim();
	if (!coordinates && !search) throw new PlaceFailed(`Claude found no coordinates or map search for "${label}"`);
	return { label, coordinates, search, confident: output.confident, reason: output.reason.trim(), webSearches };
}

/** What the prompt gets from a post: its details, notes, captions and text. */
export function placeRequestPost(
	post: { title: string; location: string; trip_start: string | null; trip_end: string | null },
	notes: string,
	photos: { note: string; caption: string }[],
	videos: { note: string; caption: string }[],
	blocks: Block[],
	request = '',
): PlaceRequestPost {
	const text: string[] = [];
	for (const block of blocks) {
		if (block.type === 'heading') text.push(block.text);
		else if (block.type === 'paragraph') text.push(block.markdown);
		else if (block.type === 'quote') text.push(`"${block.text}"${block.attribution ? ` (${block.attribution})` : ''}`);
	}
	return {
		request,
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

/** Asks Claude for the place. `post.request` is what the admins typed, if anything. */
export async function findPlace(config: PlaceConfig, post: PlaceRequestPost): Promise<PlaceSuggestion> {
	const client = new Anthropic({ apiKey: config.apiKey });
	const messages: BetaMessageParam[] = [{ role: 'user', content: placeRequestText(post) }];
	const allBlocks: BetaContentBlock[] = [];
	let webSearches = 0;

	for (let turn = 0; ; turn++) {
		const response = await client.beta.messages.parse({
			model: config.model,
			max_tokens: 4000,
			system: PLACE_SYSTEM_PROMPT,
			tools: [
				{ type: 'web_search_20260318', name: 'web_search', max_uses: MAX_SEARCHES },
				{ type: 'web_fetch_20260318', name: 'web_fetch', max_uses: MAX_FETCHES },
			],
			output_config: { effort: 'medium', format: betaZodOutputFormat(placeOutputSchema) },
			messages,
		});
		allBlocks.push(...response.content);
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
		return toSuggestion(output, pagesSeen(allBlocks), webSearches);
	}
}
