import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { createDraftPost, slugExists } from '../../../../lib/db';
import { handle, parseWith } from '../../../../lib/http';
import { slugify, uniqueSlug } from '../../../../lib/slug';

const newPostSchema = z.object({ title: z.string().trim().min(1, 'Give the post a working title').max(200) });

/** Creates a draft from the "New post" form, then sends the admin to its upload page. */
export const POST: APIRoute = ({ request, locals, redirect }) =>
	handle(async () => {
		const form = await request.formData();
		const { title } = parseWith(newPostSchema, { title: form.get('title') });
		const id = crypto.randomUUID();
		const slug = await uniqueSlug(slugify(title), slugExists);
		await createDraftPost({ id, slug, title, createdBy: locals.adminEmail });
		return redirect(`/admin/posts/${id}`, 303);
	});
