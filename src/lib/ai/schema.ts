import { z } from 'astro/zod';
import { bodySchema, referencedPhotoIds, type Block } from '../blocks';

// The shape Claude must return for a draft, enforced by the API's structured
// outputs. Photos and videos are referred to by short labels ("P1", "V1", ...)
// given in the prompt rather than database ids, which are long and easy to garble.

const label = z.string().describe('A photo label from the prompt, such as "P3"');
const videoLabel = z.string().describe('A video label from the prompt, such as "V1"');

export const draftOutputSchema = z.object({
	title: z.string().describe('Post title, without the trip dates'),
	summary: z.string().describe('One or two sentences shown under the title and on the homepage card'),
	cover_photo: label.describe('The photo to use as the post cover on the homepage'),
	blocks: z.array(
		z.discriminatedUnion('type', [
			z.object({ type: z.literal('heading'), text: z.string() }),
			z.object({ type: z.literal('paragraph'), markdown: z.string() }),
			z.object({ type: z.literal('photo'), photo: label }),
			z.object({ type: z.literal('gallery'), photos: z.array(label) }),
			z.object({ type: z.literal('video'), video: videoLabel }),
			z.object({ type: z.literal('quote'), text: z.string(), attribution: z.string() }),
		]),
	),
	photo_captions: z.array(
		z.object({
			photo: label,
			caption: z.string().describe("Short caption in the journal's voice, shown under the photo"),
			alt: z.string().describe('Alt text describing the photo for screen readers'),
		}),
	),
	video_captions: z.array(
		z.object({
			video: videoLabel,
			caption: z.string().describe("Short caption in the journal's voice, shown under the video"),
		}),
	),
});

export type DraftOutput = z.infer<typeof draftOutputSchema>;

export interface ConvertedDraft {
	title: string;
	summary: string;
	coverPhotoId: string;
	body: Block[];
	captions: { photoId: string; caption: string; alt: string }[];
	videoCaptions: { videoId: string; caption: string }[];
}

/**
 * Maps photo and video labels to database ids and checks the result against the
 * post body format. Throws with a description of every problem; a draft that
 * references media that doesn't exist must fail, not render with it missing.
 */
export function convertDraft(
	output: DraftOutput,
	photoIdsByLabel: Map<string, string>,
	videoIdsByLabel: Map<string, string> = new Map(),
): ConvertedDraft {
	const problems: string[] = [];
	const id = (photoLabel: string, where: string): string => {
		const photoId = photoIdsByLabel.get(photoLabel.trim().toUpperCase());
		if (!photoId) problems.push(`${where} refers to unknown photo "${photoLabel}"`);
		return photoId ?? '';
	};
	const videoId = (videoLabel: string, where: string): string => {
		const found = videoIdsByLabel.get(videoLabel.trim().toUpperCase());
		if (!found) problems.push(`${where} refers to unknown video "${videoLabel}"`);
		return found ?? '';
	};

	const body = output.blocks.map((block, index): Block => {
		const where = `Block ${index + 1}`;
		switch (block.type) {
			case 'heading':
				return { type: 'heading', text: block.text.trim() };
			case 'paragraph':
				return { type: 'paragraph', markdown: block.markdown.trim() };
			case 'quote':
				return block.attribution.trim()
					? { type: 'quote', text: block.text.trim(), attribution: block.attribution.trim() }
					: { type: 'quote', text: block.text.trim() };
			case 'photo':
				return { type: 'photo', photoId: id(block.photo, where) };
			case 'gallery':
				return { type: 'gallery', photoIds: block.photos.map((p) => id(p, where)) };
			case 'video':
				return { type: 'video', videoId: videoId(block.video, where) };
		}
	});

	const coverPhotoId = id(output.cover_photo, 'cover_photo');
	const captions = output.photo_captions.map((c) => ({
		photoId: id(c.photo, 'photo_captions'),
		caption: c.caption.trim(),
		alt: c.alt.trim(),
	}));

	const videoCaptions = output.video_captions.map((c) => ({
		videoId: videoId(c.video, 'video_captions'),
		caption: c.caption.trim(),
	}));

	if (!output.title.trim()) problems.push('Title is empty');
	if (body.length === 0) problems.push('The draft has no content');
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) problems.push(`Block ${Number(issue.path[0]) + 1}: ${issue.message}`);
	}
	const duplicates = referencedPhotoIds(body).length !== body.flatMap((b) =>
		b.type === 'photo' ? [b.photoId] : b.type === 'gallery' ? b.photoIds : [],
	).length;
	if (duplicates) problems.push('A photo appears more than once in the post');
	const videoBlocks = body.flatMap((b) => (b.type === 'video' ? [b.videoId] : []));
	if (new Set(videoBlocks).size !== videoBlocks.length) problems.push('A video appears more than once in the post');

	if (problems.length > 0) throw new Error(`The AI draft was not usable: ${problems.join('; ')}`);
	return {
		title: output.title.trim(),
		summary: output.summary.trim(),
		coverPhotoId,
		body,
		captions,
		videoCaptions,
	};
}
