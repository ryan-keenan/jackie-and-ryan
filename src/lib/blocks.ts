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

/**
 * Parses a stored body and checks that every photo it references belongs to the
 * post. Throws on any mismatch: a broken body should surface as an error, not
 * render as a post with silently missing photos.
 */
export function parseBody(json: string, postPhotoIds: Iterable<string>): Block[] {
	const body = bodySchema.parse(JSON.parse(json));
	const known = new Set(postPhotoIds);
	const missing = referencedPhotoIds(body).filter((id) => !known.has(id));
	if (missing.length > 0) {
		throw new Error(`Post body references photos not attached to the post: ${missing.join(', ')}`);
	}
	return body;
}
