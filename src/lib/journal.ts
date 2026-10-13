import type { PostListItem } from './db';
import { formatTripDates, mediaUrl } from './format';

// The homepage lists database posts alongside fixed entries that live outside the
// database (the original wedding page in public/wedding/). Both become cards,
// newest first by the date the entry is about.

export interface JournalCard {
	href: string;
	title: string;
	summary: string;
	/** "Location · Dates" line above the title; empty when neither is known. */
	meta: string;
	image: { src: string; alt: string; position?: string } | null;
	/** YYYY-MM-DD used for ordering. */
	date: string;
}

/** Entries that are not in the database. Dates are YYYY-MM-DD. */
export const STATIC_ENTRIES: JournalCard[] = [
	{
		href: '/wedding/',
		title: 'Our Wedding',
		summary: 'A winter solstice lunch with family and friends at Tamarine.',
		meta: ['Palo Alto, CA', formatTripDates('2025-12-21', null)].join(' · '),
		// The faces sit in the lower part of this portrait photo; keep them in the landscape crop.
		image: { src: '/journal/wedding-card.jpg', alt: 'Jackie and Ryan', position: '50% 78%' },
		date: '2025-12-21',
	},
];

export function postCard(post: PostListItem): JournalCard {
	// A post without trip dates sorts by when it was published.
	const date = post.trip_start ?? post.published_at?.slice(0, 10);
	if (!date) throw new Error(`Published post ${post.id} has neither trip dates nor a publish date`);
	return {
		href: `/posts/${post.slug}`,
		title: post.title,
		summary: post.summary,
		meta: [post.location, formatTripDates(post.trip_start, post.trip_end)].filter(Boolean).join(' · '),
		image: post.cover_thumb_key ? { src: mediaUrl(post.cover_thumb_key), alt: post.cover_alt ?? '' } : null,
		date,
	};
}

/** Posts and static entries as cards, newest first. */
export function journalCards(posts: PostListItem[], staticEntries: JournalCard[] = STATIC_ENTRIES): JournalCard[] {
	return [...posts.map(postCard), ...staticEntries].sort((a, b) => b.date.localeCompare(a.date));
}
