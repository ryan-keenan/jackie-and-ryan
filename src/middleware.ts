import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { AccessDenied, accessCookieToken, readAccessConfig, verifyAdmin } from './lib/access';

export function isAdminPath(pathname: string): boolean {
	return /^\/(api\/)?admin(\/|$)/.test(pathname);
}

/**
 * The signed-in admin's email for a request, or AccessDenied. Admin pages use the
 * header Access adds on the paths it guards; public pages, which Access doesn't
 * guard, use its sign-in cookie.
 */
async function authenticateAdmin(request: Request, source: 'header' | 'cookie'): Promise<string> {
	if (import.meta.env.DEV) {
		// `npm run dev` has no Cloudflare Access in front of it, so the local admin
		// identity comes from .dev.vars. import.meta.env.DEV is false in production
		// builds, so this branch is removed from the deployed Worker.
		const devEmail = env.DEV_ADMIN_EMAIL;
		if (!devEmail) throw new Error('Set DEV_ADMIN_EMAIL in .dev.vars to use the admin pages locally');
		return devEmail.toLowerCase();
	}
	const token =
		source === 'header' ? request.headers.get('cf-access-jwt-assertion') : accessCookieToken(request.headers.get('cookie'));
	return verifyAdmin(token, readAccessConfig(env));
}

/** Whether a public-page visitor is a signed-in admin. A missing or non-admin login is simply "no". */
async function isSignedInAdmin(request: Request): Promise<boolean> {
	try {
		await authenticateAdmin(request, 'cookie');
		return true;
	} catch (error) {
		if (error instanceof AccessDenied) return false;
		throw error;
	}
}

export const onRequest = defineMiddleware(async (context, next) => {
	// One address for the site: www.jackieandryan.us -> jackieandryan.us, same path.
	if (context.url.hostname.startsWith('www.')) {
		const target = new URL(context.url);
		target.hostname = target.hostname.slice('www.'.length);
		return Response.redirect(target.toString(), 301);
	}

	if (!isAdminPath(context.url.pathname)) {
		if (context.url.pathname.startsWith('/media/')) return next();
		// Public pages work for everyone; they only show admin links (the header
		// "Admin" button, "Edit post") when the visitor is a signed-in admin.
		context.locals.isAdmin = await isSignedInAdmin(context.request);
		const response = await next();
		// A page with admin links must not be cached and shown to someone else.
		if (context.locals.isAdmin) response.headers.set('cache-control', 'private, no-cache');
		return response;
	}

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
		context.locals.adminEmail = await authenticateAdmin(context.request, 'header');
		context.locals.isAdmin = true;
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
