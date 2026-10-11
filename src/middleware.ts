import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { AccessDenied, readAccessConfig, verifyAdmin } from './lib/access';

export function isAdminPath(pathname: string): boolean {
	return /^\/(api\/)?admin(\/|$)/.test(pathname);
}

/** The signed-in admin's email for a request, or AccessDenied. */
async function authenticateAdmin(request: Request): Promise<string> {
	if (import.meta.env.DEV) {
		// `npm run dev` has no Cloudflare Access in front of it, so the local admin
		// identity comes from .dev.vars. import.meta.env.DEV is false in production
		// builds, so this branch is removed from the deployed Worker.
		const devEmail = env.DEV_ADMIN_EMAIL;
		if (!devEmail) throw new Error('Set DEV_ADMIN_EMAIL in .dev.vars to use the admin pages locally');
		return devEmail.toLowerCase();
	}
	return verifyAdmin(request.headers.get('cf-access-jwt-assertion'), readAccessConfig(env));
}

export const onRequest = defineMiddleware(async (context, next) => {
	if (!isAdminPath(context.url.pathname)) return next();

	// Changes must come from the admin pages themselves, not from another site
	// riding on the admin's Access login cookie.
	const { method } = context.request;
	if (method !== 'GET' && method !== 'HEAD') {
		const origin = context.request.headers.get('origin');
		if (origin !== context.url.origin) {
			return new Response('Cross-origin request rejected', { status: 403 });
		}
	}

	try {
		context.locals.adminEmail = await authenticateAdmin(context.request);
	} catch (error) {
		if (error instanceof AccessDenied) {
			console.warn(`Admin access denied for ${context.url.pathname}: ${error.message}`);
			return new Response('Forbidden', { status: 403 });
		}
		throw error;
	}

	const response = await next();
	// Admin pages show drafts and private photos; never cache them anywhere.
	response.headers.set('cache-control', 'private, no-store');
	return response;
});
