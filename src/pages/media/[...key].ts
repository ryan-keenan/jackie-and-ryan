import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getServableImageVisibility } from '../../lib/db';

// Serves display and thumbnail images from R2 (Cloudflare's file storage).
// Only images attached to a published public post are served. Private-post
// images return 404 until family logins exist; originals and draft photos are
// never served from here.
export const GET: APIRoute = async ({ params }) => {
	const key = params.key;
	if (!key) return new Response('Not found', { status: 404 });

	const visibility = await getServableImageVisibility(key);
	if (visibility !== 'public') return new Response('Not found', { status: 404 });

	const object = await env.PHOTOS.get(key);
	if (!object) {
		// The database says this image exists, so a missing file is a real fault.
		throw new Error(`Photo ${key} is in the database but missing from R2`);
	}

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	// Keys include the photo id and never change contents, so caching can be long.
	headers.set('cache-control', 'public, max-age=31536000, immutable');
	return new Response(object.body, { headers });
};
