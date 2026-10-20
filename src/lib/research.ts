import { z } from 'astro/zod';

// Background research for a post: short notes about its place and activity,
// found on the web by a research job (src/lib/ai/research.ts) and reviewed by
// the admins before drafting. Stored as JSON in posts.research.

export const RESEARCH_PROVIDERS = ['claude', 'gemini'] as const;
export type ResearchProvider = (typeof RESEARCH_PROVIDERS)[number];

export const RESEARCH_PROVIDER_LABELS: Record<ResearchProvider, string> = {
	claude: 'Claude with web search',
	gemini: 'Gemini with Google Search',
};

const sourceSchema = z.object({
	url: z.url(),
	title: z.string(),
	/** False when the URL didn't appear in the search results the model saw, so it may be made up. */
	verified: z.boolean(),
});

export const researchItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().trim().min(1).max(2000),
	sources: z.array(sourceSchema),
});

export const researchSchema = z.object({
	provider: z.enum(RESEARCH_PROVIDERS),
	model: z.string(),
	createdAt: z.string(),
	/** Which place the model decided it was researching, so a wrong guess is easy to spot. */
	placeResearched: z.string(),
	items: z.array(researchItemSchema),
	/**
	 * Gemini only: Google's "search suggestions" HTML. Google's terms for
	 * grounded results ask that it be shown with them; the admin page does.
	 */
	searchSuggestions: z.array(z.string()),
});

export type ResearchSource = z.infer<typeof sourceSchema>;
export type ResearchItem = z.infer<typeof researchItemSchema>;
export type Research = z.infer<typeof researchSchema>;

/** The stored research, or null if the post was never researched. Throws on a malformed value. */
export function parseResearch(json: string | null): Research | null {
	return json === null ? null : researchSchema.parse(JSON.parse(json));
}
