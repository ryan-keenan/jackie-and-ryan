import { z } from 'astro/zod';

// A post body is an ordered list of blocks. AI drafts must produce exactly this
// shape, and the editor edits it, so it is validated whenever it is read or written.

const photoId = z.string().min(1);

export const blockSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('heading'), text: z.string().min(1) }),
	// Markdown. Raw HTML is not rendered (see src/lib/markdown.ts).
	z.object({ type: z.literal('paragraph'), markdown: z.string().min(1) }),
	z.object({ type: z.literal('photo'), photoId }),
	z.object({ type: z.literal('gallery'), photoIds: z.array(photoId).min(2).max(6) }),
	// A Cloudflare Stream video from the post's videos table.
	z.object({ type: z.literal('video'), videoId: z.string().min(1) }),
	z.object({
		type: z.literal('quote'),
		text: z.string().min(1),
		attribution: z.string().optional(),
	}),
]);

export const bodySchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;

/** Every photo id a body references, in order of first appearance. */
export function referencedPhotoIds(body: Block[]): string[] {
	const ids: string[] = [];
	for (const block of body) {
		if (block.type === 'photo') ids.push(block.photoId);
		if (block.type === 'gallery') ids.push(...block.photoIds);
	}
	return [...new Set(ids)];
}

/** Every video id a body references, in order of first appearance. */
export function referencedVideoIds(body: Block[]): string[] {
	return [...new Set(body.flatMap((block) => (block.type === 'video' ? [block.videoId] : [])))];
}

/**
 * Parses a stored body and checks that every photo and video it references
 * belongs to the post. Throws on any mismatch: a broken body should surface as
 * an error, not render as a post with silently missing media.
 */
export function parseBody(json: string, postPhotoIds: Iterable<string>, postVideoIds: Iterable<string> = []): Block[] {
	const body = bodySchema.parse(JSON.parse(json));
	const knownPhotos = new Set(postPhotoIds);
	const missingPhotos = referencedPhotoIds(body).filter((id) => !knownPhotos.has(id));
	if (missingPhotos.length > 0) {
		throw new Error(`Post body references photos not attached to the post: ${missingPhotos.join(', ')}`);
	}
	const knownVideos = new Set(postVideoIds);
	const missingVideos = referencedVideoIds(body).filter((id) => !knownVideos.has(id));
	if (missingVideos.length > 0) {
		throw new Error(`Post body references videos not attached to the post: ${missingVideos.join(', ')}`);
	}
	return body;
}

/**
 * Splits off the photo or gallery that opens a post, which is shown right under
 * the title and summary (above the map). Bodies that open with text have none.
 */
export function splitOpening(body: Block[]): { opening: Block[]; rest: Block[] } {
	const first = body[0];
	if (first && (first.type === 'photo' || first.type === 'gallery')) return { opening: [first], rest: body.slice(1) };
	return { opening: [], rest: body };
}
