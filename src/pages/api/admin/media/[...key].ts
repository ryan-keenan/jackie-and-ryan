import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isKnownImageKey } from '../../../../lib/db';

// Display and thumbnail images for the admin pages, including drafts and private
// posts. The public route (src/pages/media) only serves published public photos.
export const GET: APIRoute = async ({ params }) => {
	const key = params.key;
	if (!key || !(await isKnownImageKey(key))) return new Response('Not found', { status: 404 });

	const object = await env.PHOTOS.get(key);
	if (!object) throw new Error(`Photo ${key} is in the database but missing from R2`);

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	return new Response(object.body, { headers });
};
