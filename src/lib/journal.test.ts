import { describe, expect, it } from 'vitest';
import type { PostListItem } from './db';
import { journalCards, postCard, type JournalCard } from './journal';

function post(overrides: Partial<PostListItem>): PostListItem {
	return {
		id: 'p1',
		slug: 'taiwan',
		title: 'Taiwan',
		summary: 'Night markets',
		trip_start: '2026-03-03',
		trip_end: '2026-03-12',
		location: 'Taipei',
		published_at: '2026-04-01T10:00:00.000Z',
		cover_thumb_key: 'photos/p1/a/thumb.jpg',
		cover_alt: 'Taipei 101',
		...overrides,
	};
}

const wedding: JournalCard = {
	href: '/wedding/',
	title: 'Our Wedding',
	summary: '',
	meta: '',
	image: null,
	date: '2025-12-21',
};

describe('postCard', () => {
	it('builds the card from the post', () => {
		expect(postCard(post({}))).toEqual({
			href: '/posts/taiwan',
			title: 'Taiwan',
			summary: 'Night markets',
			meta: 'Taipei · March 3–12, 2026',
			image: { src: '/media/photos/p1/a/thumb.jpg', alt: 'Taipei 101' },
			date: '2026-03-03',
		});
	});

	it('falls back to the publish date for ordering when there are no trip dates', () => {
		const card = postCard(post({ trip_start: null, trip_end: null, location: '' }));
		expect(card.date).toBe('2026-04-01');
		expect(card.meta).toBe('');
	});

	it('throws when a post has no date at all', () => {
		expect(() => postCard(post({ trip_start: null, published_at: null }))).toThrow(/neither trip dates/);
	});
});

describe('journalCards', () => {
	it('mixes posts and static entries newest first', () => {
		const cards = journalCards(
			[post({ id: 'a', slug: 'a', trip_start: '2025-06-01' }), post({ id: 'b', slug: 'b', trip_start: '2026-02-01' })],
			[wedding],
		);
		expect(cards.map((card) => card.href)).toEqual(['/posts/b', '/wedding/', '/posts/a']);
	});
});
