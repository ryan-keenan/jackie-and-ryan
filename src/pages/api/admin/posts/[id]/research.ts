import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import type { ResearchJobMessage } from '../../../../../lib/ai/job';
import { readResearchConfig } from '../../../../../lib/ai/research';
import { createJob, getPostForAdmin, latestJobForPost, saveResearch } from '../../../../../lib/db';
import { BadRequest, handle, json, parseWith, readJson } from '../../../../../lib/http';
import { parseResearch, RESEARCH_PROVIDERS, researchItemSchema } from '../../../../../lib/research';

/** Starts a research job with the chosen service. The page polls /api/admin/jobs/:id for the result. */
export const POST: APIRoute = ({ params, request }) =>
	handle(async () => {
		const { provider } = parseWith(z.object({ provider: z.enum(RESEARCH_PROVIDERS) }).strict(), await readJson(request));
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);

		let model: string;
		try {
			model = readResearchConfig(provider, env).model;
		} catch (error) {
			throw new BadRequest((error as Error).message, 500);
		}
		const latest = await latestJobForPost(post.id, 'research');
		if (latest && (latest.status === 'queued' || latest.status === 'running')) {
			throw new BadRequest('Research is already running for this post', 409);
		}

		const jobId = crypto.randomUUID();
		await createJob({ id: jobId, postId: post.id, kind: 'research', model });
		await env.DRAFT_QUEUE.send({ jobId, provider } satisfies ResearchJobMessage);
		return json({ id: jobId, status: 'queued' }, 202);
	});

/**
 * Saves the admins' edits: the items to keep, with any rewording. Items can be
 * removed or edited but not added, and their sources stay as found.
 */
export const PUT: APIRoute = ({ params, request }) =>
	handle(async () => {
		const { items } = parseWith(
			z.object({ items: z.array(researchItemSchema.pick({ id: true, text: true })) }).strict(),
			await readJson(request),
		);
		const post = await getPostForAdmin(params.id!);
		if (!post) throw new BadRequest('Post not found', 404);
		const research = parseResearch(post.research);
		if (!research) throw new BadRequest('This post has no research to edit', 409);

		const existing = new Map(research.items.map((item) => [item.id, item]));
		const unknown = items.filter((item) => !existing.has(item.id));
		if (unknown.length > 0) throw new BadRequest('Some research items no longer exist; reload the page', 409);
		research.items = items.map((item) => ({ ...existing.get(item.id)!, text: item.text }));
		await saveResearch(post.id, JSON.stringify(research));
		return json({ ok: true, count: research.items.length });
	});

/** Removes the post's research entirely. */
export const DELETE: APIRoute = ({ params }) =>
	handle(async () => {
		if (!(await saveResearch(params.id!, null))) throw new BadRequest('Post not found', 404);
		return json({ ok: true });
	});
