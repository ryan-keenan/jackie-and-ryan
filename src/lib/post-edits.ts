import { parseBody } from './blocks';
import type { PhotoRow, PostRow, VideoRow } from './db';
import { buildSnapshot, hasUnpublishedEdits, parseSnapshot } from './snapshot';

/**
 * Whether a published post has edits readers don't see yet. Unpublished posts
 * have none to show. A body that can't be parsed counts as edited: publishing is
 * the step that will report what's wrong with it.
 */
export function postHasUnpublishedEdits(
	post: PostRow,
	photos: Pick<PhotoRow, 'id' | 'caption' | 'alt'>[],
	videos: Pick<VideoRow, 'id' | 'caption'>[],
): boolean {
	if (post.status !== 'published') return false;
	try {
		parseBody(post.body, photos.map((photo) => photo.id), videos.map((video) => video.id));
	} catch {
		return true;
	}
	return hasUnpublishedEdits(buildSnapshot(post, photos, videos), parseSnapshot(post.published_snapshot));
}
