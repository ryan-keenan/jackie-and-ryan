import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaContentBlock, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { GoogleGenAI } from '@google/genai';
import { z } from 'astro/zod';
import type { ResearchItem, ResearchProvider, ResearchSource } from '../research';
import { RESEARCH_SYSTEM_PROMPT, researchRequestText, type ResearchRequestPost } from './research-prompt';

// Background research with web search, on either Claude (Anthropic's web search
// tool) or Gemini (Grounding with Google Search). Both run the searches on the
// provider's side within one request and return structured JSON matching
// researchOutputSchema. Source URLs the model lists are checked against the
// pages its searches actually returned, and any that weren't are marked
// unverified rather than dropped, so the admins can see and judge them.

/** Upper bound on searches per research run (Claude); keeps cost and time predictable. */
const MAX_SEARCHES = 8;
/** Times a paused Claude turn (stop_reason "pause_turn") is resumed before giving up. */
const MAX_CONTINUATIONS = 4;

export const researchOutputSchema = z.object({
	place_researched: z.string().describe('The specific place researched, e.g. "Eagle Lake, Desolation Wilderness, near Emerald Bay, Lake Tahoe"'),
	items: z.array(
		z.object({
			text: z.string().describe('One to three plain sentences of sourced fact'),
			source_urls: z.array(z.string()).describe('URLs of the search results this item comes from'),
		}),
	),
});
export type ResearchOutput = z.infer<typeof researchOutputSchema>;

export interface ResearchConfig {
	provider: ResearchProvider;
	apiKey: string;
	model: string;
}

type ResearchEnv = {
	ANTHROPIC_API_KEY?: string;
	GEMINI_API_KEY?: string;
	RESEARCH_CLAUDE_MODEL?: string;
	RESEARCH_GEMINI_MODEL?: string;
};

/** Reads one provider's settings. Missing settings fail with a message naming them. */
export function readResearchConfig(provider: ResearchProvider, env: ResearchEnv): ResearchConfig {
	const [keyName, modelName] =
		provider === 'claude'
			? (['ANTHROPIC_API_KEY', 'RESEARCH_CLAUDE_MODEL'] as const)
			: (['GEMINI_API_KEY', 'RESEARCH_GEMINI_MODEL'] as const);
	const missing = [keyName, modelName].filter((name) => !env[name]?.trim());
	if (missing.length > 0) throw new Error(`Research with ${provider} is not configured: missing ${missing.join(', ')}`);
	return { provider, apiKey: env[keyName]!.trim(), model: env[modelName]!.trim() };
}

/** A failure that retrying won't fix: a refusal, an unusable reply, or a failed run. */
export class ResearchFailed extends Error {}

export interface ResearchResult {
	placeResearched: string;
	items: ResearchItem[];
	searchSuggestions: string[];
	model: string;
	inputTokens: number;
	outputTokens: number;
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

/**
 * Turns the model's items into stored research items, marking each source
 * verified when it matches a page the searches returned (and taking that page's
 * title). Unparseable URLs are dropped: they can't be linked.
 */
export function toResearchItems(output: ResearchOutput, seen: Map<string, string>): ResearchItem[] {
	return output.items
		.filter((item) => item.text.trim())
		.map((item) => {
			const sources: ResearchSource[] = [];
			for (const url of new Set(item.source_urls)) {
				let parsed: URL;
				try {
					parsed = new URL(url);
				} catch {
					continue;
				}
				if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
				const title = seen.get(urlKey(url));
				sources.push({ url: parsed.href, title: title || parsed.hostname.replace(/^www\./, ''), verified: title !== undefined });
			}
			return { id: crypto.randomUUID(), text: item.text.trim(), sources };
		});
}

// ---- Claude -------------------------------------------------------------

/** Pages returned by Claude's web searches, including those run inside dynamic filtering. */
function claudeSearchResults(blocks: BetaContentBlock[]): Map<string, string> {
	const seen = new Map<string, string>();
	for (const block of blocks) {
		if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
		for (const result of block.content) seen.set(urlKey(result.url), result.title);
	}
	return seen;
}

async function researchWithClaude(config: ResearchConfig, request: string): Promise<ResearchResult> {
	const client = new Anthropic({ apiKey: config.apiKey });
	const messages: BetaMessageParam[] = [{ role: 'user', content: request }];
	const allBlocks: BetaContentBlock[] = [];
	let inputTokens = 0;
	let outputTokens = 0;
	let webSearches = 0;

	for (let turn = 0; ; turn++) {
		const response = await client.beta.messages.parse({
			model: config.model,
			max_tokens: 16000,
			system: RESEARCH_SYSTEM_PROMPT,
			tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: MAX_SEARCHES }],
			output_config: { effort: 'medium', format: betaZodOutputFormat(researchOutputSchema) },
			messages,
		});
		allBlocks.push(...response.content);
		inputTokens += response.usage.input_tokens;
		outputTokens += response.usage.output_tokens;
		webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;

		// A long search turn can pause; sending it back unchanged lets it continue.
		if (response.stop_reason === 'pause_turn') {
			if (turn >= MAX_CONTINUATIONS) throw new ResearchFailed('Research took too many rounds of searching. Try again.');
			messages.push({ role: 'assistant', content: response.content as BetaMessageParam['content'] });
			continue;
		}
		if (response.stop_reason === 'refusal') {
			throw new ResearchFailed(`Claude declined this research (category: ${response.stop_details?.category ?? 'unspecified'}).`);
		}
		if (response.stop_reason === 'max_tokens') throw new ResearchFailed('The research was cut off because it ran too long.');
		if (!response.parsed_output) throw new ResearchFailed('Claude returned research that could not be read');

		return {
			placeResearched: response.parsed_output.place_researched,
			items: toResearchItems(response.parsed_output, claudeSearchResults(allBlocks)),
			searchSuggestions: [],
			model: response.model,
			inputTokens,
			outputTokens,
			webSearches,
		};
	}
}

// ---- Gemini -------------------------------------------------------------

/** The parts of a finished Interaction this code reads (see the SDK's Interaction type). */
interface GeminiInteraction {
	status: string;
	output_text?: string;
	steps?: {
		type: string;
		content?: { type: string; annotations?: { type: string; url?: string; title?: string }[] }[];
		result?: { search_suggestions?: string }[];
	}[];
	usage?: { total_input_tokens?: number; total_output_tokens?: number; grounding_tool_count?: { type?: string; count?: number }[] };
}

/**
 * The SDK reports account problems with a bare status and an empty body
 * ("402 API error occurred: {...}"); these say what to fix instead.
 */
async function geminiAccountErrors<T>(call: Promise<T>): Promise<T> {
	try {
		return await call;
	} catch (error) {
		const status = (error as { status?: unknown }).status;
		if (status === 402) {
			throw new ResearchFailed('Gemini refused the request for billing reasons (HTTP 402). Set up billing for the API key\u2019s project in Google AI Studio.');
		}
		if (status === 401 || status === 403) {
			throw new ResearchFailed(`Gemini rejected the API key (HTTP ${status}). Check GEMINI_API_KEY and that the Gemini API is enabled for its project.`);
		}
		throw error;
	}
}

const GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

/**
 * Gemini cites pages through temporary Google redirect links, which would
 * break in a published post's source list. Each is replaced by the page it
 * redirects to. A link that can't be resolved is kept but marked unverified, so
 * the admins see it and can check or remove it.
 */
export async function resolveGroundingRedirects(items: ResearchItem[], fetchFn: typeof fetch = fetch): Promise<ResearchItem[]> {
	const redirects = new Set(items.flatMap((item) => item.sources.map((s) => s.url)).filter((url) => new URL(url).hostname === GROUNDING_REDIRECT_HOST));
	const resolved = new Map<string, string | null>();
	await Promise.all(
		[...redirects].map(async (url) => {
			try {
				const response = await fetchFn(url, { method: 'GET', redirect: 'manual' });
				const location = response.headers.get('location');
				resolved.set(url, location && /^https?:\/\//.test(location) ? location : null);
			} catch {
				resolved.set(url, null);
			}
		}),
	);
	return items.map((item) => {
		const sources = new Map<string, ResearchSource>();
		for (const source of item.sources) {
			if (!redirects.has(source.url)) {
				sources.set(source.url, source);
				continue;
			}
			const target = resolved.get(source.url);
			if (target) sources.set(target, { ...source, url: target });
			else sources.set(source.url, { ...source, verified: false });
		}
		return { ...item, sources: [...sources.values()] };
	});
}

async function researchWithGemini(config: ResearchConfig, request: string): Promise<ResearchResult> {
	const client = new GoogleGenAI({ apiKey: config.apiKey });
	const interaction = (await geminiAccountErrors(client.interactions.create({
		model: config.model,
		system_instruction: RESEARCH_SYSTEM_PROMPT,
		input: request,
		tools: [{ type: 'google_search' }],
		response_format: { type: 'text', mime_type: 'application/json', schema: z.toJSONSchema(researchOutputSchema) },
		generation_config: { thinking_level: 'medium', max_output_tokens: 16000 },
		// Nothing needs the interaction later, so Google doesn't keep it.
		store: false,
	}))) as unknown as GeminiInteraction;

	if (interaction.status !== 'completed') {
		throw new ResearchFailed(`Gemini didn't finish the research (status: ${interaction.status}).`);
	}
	const text = interaction.output_text;
	if (!text) throw new ResearchFailed('Gemini returned no research');
	let output: ResearchOutput;
	try {
		output = researchOutputSchema.parse(JSON.parse(text));
	} catch {
		throw new ResearchFailed('Gemini returned research that could not be read');
	}

	// Gemini doesn't return the pages its searches found; the URLs it cites in
	// annotations are the closest record of what it actually read.
	const seen = new Map<string, string>();
	const searchSuggestions: string[] = [];
	for (const step of interaction.steps ?? []) {
		if (step.type === 'model_output') {
			for (const content of step.content ?? []) {
				for (const annotation of content.annotations ?? []) {
					if (annotation.type === 'url_citation' && annotation.url) seen.set(urlKey(annotation.url), annotation.title ?? '');
				}
			}
		}
		if (step.type === 'google_search_result') {
			for (const result of step.result ?? []) if (result.search_suggestions) searchSuggestions.push(result.search_suggestions);
		}
	}
	const searches = (interaction.usage?.grounding_tool_count ?? [])
		.filter((count) => count.type === 'google_search')
		.reduce((sum, count) => sum + (count.count ?? 0), 0);

	return {
		placeResearched: output.place_researched,
		items: await resolveGroundingRedirects(toResearchItems(output, seen)),
		searchSuggestions,
		model: config.model,
		inputTokens: interaction.usage?.total_input_tokens ?? 0,
		outputTokens: interaction.usage?.total_output_tokens ?? 0,
		webSearches: searches,
	};
}

export async function runResearch(config: ResearchConfig, post: ResearchRequestPost): Promise<ResearchResult> {
	const request = researchRequestText(post);
	return config.provider === 'claude' ? researchWithClaude(config, request) : researchWithGemini(config, request);
}

/** True for errors worth retrying later: rate limits, server errors and network failures, from either SDK. */
export function isRetryableResearchError(error: unknown): boolean {
	if (
		error instanceof Anthropic.RateLimitError ||
		error instanceof Anthropic.InternalServerError ||
		error instanceof Anthropic.APIConnectionError
	) {
		return true;
	}
	if (error instanceof Anthropic.APIError) return false;
	const status = (error as { status?: unknown }).status;
	if (typeof status === 'number') return status === 429 || status >= 500;
	const name = (error as { name?: unknown }).name;
	return name === 'ConnectionError' || name === 'RequestTimeoutError';
}
