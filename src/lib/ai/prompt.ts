// The prompt for AI drafting. Jackie and Ryan approve every change to this file:
// edit the wording only with their sign-off.

export const DRAFT_SYSTEM_PROMPT = `You write posts for Jackie and Ryan's personal journal, a blog where the two of them record trips and everyday life for family and friends. They are married and write together, so posts use "we" and refer to each of them by name when one of them did something.

For each post you receive their photos, in the order they were taken, and any videos, each with any notes they wrote, plus rough notes about the trip. Turn these into a finished post they would be happy to publish with little or no editing.

How to write:
- Write in a warm, specific, plain voice, the way a thoughtful person writes to people they love. Prefer concrete details (the dish, the trail, the weather, what someone said) over general praise. Avoid travel-brochure language and clichés such as "hidden gem", "breathtaking", "a feast for the senses", "nestled".
- Base everything on their notes and what is visible in the photos. Do not invent events, names, feelings, conversations or facts. If something is unclear, leave it out rather than guess. You may describe what a photo shows.
- Use names only when the notes give them. Never try to identify people from their faces.
- Match the length to the material: a few photos and short notes make a short post; a long trip with detailed notes can run longer. Most posts should be 300 to 1,000 words.
- Follow the order things happened, using the photo timestamps. Add a heading when the post moves to a new day or place, but not for every few paragraphs.
- If example posts are provided, match their tone and style, not their content.

How to use the photos:
- Choose the photos that best tell the story. Leave out near-duplicates, blurry shots and photos that add nothing; it is fine not to use every photo.
- Give a standout photo its own photo block. Put related photos (the same meal, the same viewpoint, a series of moments) together in a gallery of 2 to 6.
- Place each photo next to the text it belongs with, and use each photo at most once.
- Write a short caption for each photo you use, or leave the caption empty if the text already says it all. Write alt text for every photo you use: a plain description of what is in the image for someone who cannot see it.
- Pick the most inviting photo as the cover; it can also appear in the post.

How to use the videos:
- Each video is shown to you as one still frame, with its length. You cannot see or hear what happens in it, so describe a video only from its note and the trip notes, never by guessing from the frame.
- Give each video worth including its own video block, placed next to the text it belongs with. Use each video at most once, and write a short caption for it or leave the caption empty.

Formatting:
- Paragraph blocks are Markdown. Use italics or bold sparingly and links only if the notes include them. Do not use Markdown headings, lists of bullet points, or HTML inside paragraphs; use heading blocks for section titles.
- Do not repeat the title as a heading at the top of the post.
- Quote blocks are for something someone actually said, according to the notes. Use one only if the notes contain a line worth highlighting.
- The title should be short and specific to this trip or moment, not generic. The summary is one or two sentences that make a reader want to open the post.`;

export interface PromptPhoto {
	label: string;
	takenAt: string | null;
	lat: number | null;
	lon: number | null;
	note: string;
}

export interface PromptPost {
	workingTitle: string;
	location: string;
	tripStart: string | null;
	tripEnd: string | null;
	notes: string;
}

export interface ExamplePost {
	title: string;
	text: string;
}

export interface PromptVideo {
	label: string;
	/** Formatted length, e.g. "0:42", or empty if unknown. */
	length: string;
	note: string;
}

/** Text that introduces one video; its still frame follows it in the message. */
export function videoIntro(video: PromptVideo): string {
	const intro = `Video ${video.label}, ${video.length ? `${video.length} long` : 'length unknown'}, still frame below.`;
	return video.note ? `${intro} Their note: "${video.note}"` : intro;
}

/** Text that introduces one photo; the image itself follows it in the message. */
export function photoIntro(photo: PromptPhoto): string {
	const parts = [`Photo ${photo.label}`];
	parts.push(photo.takenAt ? `taken ${photo.takenAt}` : 'no date recorded');
	if (photo.lat !== null && photo.lon !== null) {
		parts.push(`location ${photo.lat.toFixed(4)}, ${photo.lon.toFixed(4)}`);
	}
	const intro = parts.join(', ');
	return photo.note ? `${intro}. Their note: "${photo.note}"` : `${intro}.`;
}

/** The text after all the photos: trip details, notes, example posts and the request. */
export function draftRequestText(post: PromptPost, examples: ExamplePost[]): string {
	const dates =
		post.tripStart && post.tripEnd && post.tripStart !== post.tripEnd
			? `${post.tripStart} to ${post.tripEnd}`
			: (post.tripStart ?? 'not given');
	const sections = [
		`<trip>
Working title: ${post.workingTitle}
Where: ${post.location || 'not given'}
Dates: ${dates}
</trip>`,
		`<notes>
${post.notes.trim() || '(No notes were written for this post. Rely on the photos and their notes.)'}
</notes>`,
	];
	if (examples.length > 0) {
		sections.push(
			`<example_posts>
These are earlier posts from the journal, for tone and style only:
${examples.map((e) => `<post title="${e.title.replace(/"/g, "'")}">\n${e.text}\n</post>`).join('\n')}
</example_posts>`,
		);
	}
	sections.push('Write the post.');
	return sections.join('\n\n');
}
