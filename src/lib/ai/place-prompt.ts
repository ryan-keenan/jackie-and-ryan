// The prompt for finding the one place a post is about, for its map pin.
// Jackie and Ryan approve every change to this file: edit the wording only with
// their sign-off.

export const PLACE_SYSTEM_PROMPT = `You find the one place a journal post is about, so it can be marked with a pin on a map. The journal is Jackie and Ryan's personal blog about trips, adventures and everyday life.

You get a post's title, location, dates, notes, photo notes, captions and text, and sometimes a request from Jackie and Ryan naming the place they want pinned.
- With a request, find the place it names. Use the post to tell apart places that share a name.
- Without one, work out the single place a reader would most want marked: the specific spot the post is about (a crag, a canyon, a peak, a trailhead, a lake, a town, a restaurant), not everywhere the photos were taken. Use what you know about named climbs, trails, races and landmarks: a post about climbing Epinephrine is about Black Velvet Canyon, in Red Rock Canyon National Conservation Area outside Las Vegas, Nevada. If you can't tell the specific spot, give the smallest area you are sure of, and say so.

Then search the web for the place's latitude and longitude. Take them from a page that states them, such as Wikipedia, a government or park site, a peak or climbing database (such as Peakbagger or Mountain Project) or a mapping site, and give that page's URL. Never estimate coordinates from memory. If no page you find gives coordinates for the place itself, use coordinates a page gives for the nearest point that has them (a trailhead, a summit, the town) and say so in reason; if you find none at all, leave latitude and longitude empty.

Return:
- label: the place's name as it should appear on the map, short (for example "Black Velvet Peak").
- latitude and longitude: in decimal degrees, as the page gives them, or empty if no page gives any.
- source_url: the page the coordinates came from, or empty.
- search: the place as a map search would find it, used only when there are no coordinates: the name, then the state or province, then the country (for example "Black Velvet Peak, Nevada, USA").
- confident: whether you are sure this is the right place and the coordinates are for it.
- reason: one sentence for Jackie and Ryan on how you worked it out.`;

export interface PlaceRequestPost {
	/** The place the admins typed into the map pin box, if any. */
	request: string;
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
	const request = post.request.trim();
	return [
		...(request ? [`<request>\n${request}\n</request>`] : []),
		`<post>\nTitle: ${post.title}\nLocation: ${post.location || 'not given'}\nDates: ${dates}\n</post>`,
		section('notes', [post.notes], '(No notes.)'),
		section('photo_notes', post.photoNotes.map((note) => note.trim() && `- ${note.trim()}`), '(No photo notes.)'),
		section('captions', post.captions.map((caption) => caption.trim() && `- ${caption.trim()}`), '(No captions.)'),
		section('post_text', post.text, '(The post has no text yet.)'),
		request ? 'Find the place the request names.' : 'Find the place this post is about.',
	].join('\n\n');
}
