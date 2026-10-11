declare namespace App {
	interface Locals {
		/** Set by src/middleware.ts on /admin and /api/admin requests once the admin login is verified. */
		adminEmail: string;
	}
}

// Worker settings that are not in wrangler.jsonc: secrets set with
// `wrangler secret put`, and local-only values from .dev.vars.
declare namespace Cloudflare {
	interface Env {
		/** Comma-separated admin emails (secret, kept out of the public repo). */
		ADMIN_EMAILS?: string;
		/** Admin identity used by `npm run dev`, which has no Access login in front of it. */
		DEV_ADMIN_EMAIL?: string;
		ACCESS_TEAM_DOMAIN?: string;
		ACCESS_AUD?: string;
	}
}
