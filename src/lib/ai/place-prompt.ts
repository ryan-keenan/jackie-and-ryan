// The prompt for finding the one place a post is about, for its map pin.
// Jackie and Ryan approve every change to this file: edit the wording only with
// their sign-off.

export const PLACE_SYSTEM_PROMPT = `You find the one place a journal post is about, so it can be marked with a pin on a map. The journal is Jackie and Ryan's personal blog about trips, adventures and everyday life.

You get a post's title, location, dates, notes, photo notes, captions and text. Work out the single place a reader would most want marked: the specific spot the post is about (a crag, a canyon, a trailhead, a lake, a town, a restaurant), not everywhere the photos were taken.
- Use what you know about named climbs, trails, races and landmarks. A post about climbing Epinephrine is about Black Velvet Canyon, in Red Rock Canyon National Conservation Area outside Las Vegas, Nevada.
- If the post names something you don't know, search the web for it.
- If you can't tell the specific spot, give the smallest area you are sure of, and say so.

Return:
- label: the place's name as it should appear on the map, short (for example "Black Velvet Canyon").
- search: the place as a map search would find it: the name, then the state or province, then the country (for example "Black Velvet Canyon, Nevada, USA").
- confident: whether the post makes the place clear.
- reason: one sentence for Jackie and Ryan on how you worked it out.`;

export interface PlaceRequestPost {
	title: string;
	location: string;
	tripStart: string | null;
	tripEnd: string | null;
	notes: string;
	photoNotes: string[];
	captions: string[];
	/** The post's headings, paragraphs and quotes, in order. */
	text: string[];
}

function section(tag: string, lines: string[], empty: string): string {
	const kept = lines.map((line) => line.trim()).filter(Boolean);
	return `<${tag}>\n${kept.length ? kept.join('\n') : empty}\n</${tag}>`;
}

/** The user message for finding a post's place: everything written about it. */
export function placeRequestText(post: PlaceRequestPost): string {
	const dates =
		post.tripStart && post.tripEnd && post.tripStart !== post.tripEnd
			? `${post.tripStart} to ${post.tripEnd}`
			: (post.tripStart ?? 'not given');
	return [
		`<post>\nTitle: ${post.title}\nLocation: ${post.location || 'not given'}\nDates: ${dates}\n</post>`,
		section('notes', [post.notes], '(No notes.)'),
		section('photo_notes', post.photoNotes.map((note) => note.trim() && `- ${note.trim()}`), '(No photo notes.)'),
		section('captions', post.captions.map((caption) => caption.trim() && `- ${caption.trim()}`), '(No captions.)'),
		section('post_text', post.text, '(The post has no text yet.)'),
		'Find the place this post is about.',
	].join('\n\n');
}
