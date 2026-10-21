import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Cloudflare Access (Zero Trust) signs users in before requests reach the Worker
// and attaches a signed JWT in the Cf-Access-Jwt-Assertion header. Access only
// guards the paths its policy covers, so the Worker verifies that token itself
// on every admin request and rejects anything without a valid one.

export class AccessDenied extends Error {}

export interface AccessConfig {
	/** e.g. "jackieandryan.cloudflareaccess.com" */
	teamDomain: string;
	/**
	 * Audience (AUD) tags of the Access applications in front of the site, one per
	 * hostname setup (e.g. the workers.dev test address and jackieandryan.us).
	 */
	aud: string[];
	/** Lowercased emails allowed to use the admin pages. */
	adminEmails: string[];
}

/** Reads Access settings from Worker vars and secrets. Missing settings are a deploy error, so this throws. */
export function readAccessConfig(env: {
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_AUD?: string;
	ADMIN_EMAILS?: string;
}): AccessConfig {
	const missing = (['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'ADMIN_EMAILS'] as const).filter((name) => !env[name]?.trim());
	if (missing.length > 0) {
		throw new Error(`Admin login is not configured: missing ${missing.join(', ')}`);
	}
	const adminEmails = parseEmailList(env.ADMIN_EMAILS!);
	if (adminEmails.length === 0) throw new Error('ADMIN_EMAILS contains no email addresses');
	return {
		teamDomain: env.ACCESS_TEAM_DOMAIN!.trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''),
		aud: env.ACCESS_AUD!.split(',').map((tag) => tag.trim()).filter(Boolean),
		adminEmails,
	};
}

/** Comma- or whitespace-separated list, lowercased. */
export function parseEmailList(value: string): string[] {
	return value
		.split(/[\s,]+/)
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
}

// One key set per team, reused across requests in the same isolate; jose caches
// the fetched signing keys and refetches when Access rotates them.
const keySets = new Map<string, JWTVerifyGetKey>();

function keySetFor(teamDomain: string): JWTVerifyGetKey {
	let keySet = keySets.get(teamDomain);
	if (!keySet) {
		keySet = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
		keySets.set(teamDomain, keySet);
	}
	return keySet;
}

/**
 * Verifies an Access JWT and returns the signed-in admin's email.
 * Throws AccessDenied for a missing, invalid, expired or wrong-audience token,
 * or a valid token for someone who isn't an admin.
 */
export async function verifyAdmin(
	token: string | null,
	config: AccessConfig,
	keys: JWTVerifyGetKey = keySetFor(config.teamDomain),
): Promise<string> {
	if (!token) throw new AccessDenied('No Cloudflare Access token on the request');

	let email: unknown;
	try {
		const { payload } = await jwtVerify(token, keys, {
			issuer: `https://${config.teamDomain}`,
			audience: config.aud,
			algorithms: ['RS256'],
		});
		email = payload.email;
	} catch (error) {
		throw new AccessDenied(`Invalid Cloudflare Access token: ${(error as Error).message}`);
	}

	if (typeof email !== 'string' || !config.adminEmails.includes(email.toLowerCase())) {
		throw new AccessDenied(`Not an admin: ${String(email)}`);
	}
	return email.toLowerCase();
}

/**
 * The Access token from the CF_Authorization cookie. Access sends the
 * Cf-Access-Jwt-Assertion header only on paths its application covers (the admin
 * pages), but sets this cookie for the whole site after sign-in, so public pages
 * read it to tell whether the visitor is a signed-in admin.
 */
export function accessCookieToken(cookieHeader: string | null): string | null {
	for (const part of cookieHeader?.split(';') ?? []) {
		const [name, ...value] = part.trim().split('=');
		if (name === 'CF_Authorization') return value.join('=') || null;
	}
	return null;
}
