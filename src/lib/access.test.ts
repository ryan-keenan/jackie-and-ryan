import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { AccessDenied, parseEmailList, readAccessConfig, verifyAdmin, type AccessConfig } from './access';

const config: AccessConfig = {
	teamDomain: 'example.cloudflareaccess.com',
	aud: ['test-aud', 'second-app-aud'],
	adminEmails: ['jackie@example.com', 'ryan@example.com'],
};

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
	const pair = await generateKeyPair('RS256');
	signingKey = pair.privateKey;
	otherKey = (await generateKeyPair('RS256')).privateKey;
	const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };
	keys = createLocalJWKSet({ keys: [jwk] });
});

function token(claims: Record<string, unknown>, opts: { key?: CryptoKey; aud?: string; iss?: string; exp?: string } = {}) {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: 'RS256', kid: 'k1' })
		.setIssuer(opts.iss ?? `https://${config.teamDomain}`)
		.setAudience(opts.aud ?? config.aud[0])
		.setIssuedAt()
		.setExpirationTime(opts.exp ?? '1h')
		.sign(opts.key ?? signingKey);
}

describe('verifyAdmin', () => {
	it('returns the email for a valid admin token, case-insensitively', async () => {
		expect(await verifyAdmin(await token({ email: 'Jackie@Example.com' }), config, keys)).toBe('jackie@example.com');
	});

	it('accepts tokens from any of the configured Access applications', async () => {
		expect(await verifyAdmin(await token({ email: 'ryan@example.com' }, { aud: 'second-app-aud' }), config, keys)).toBe('ryan@example.com');
	});

	it('rejects a missing token', async () => {
		await expect(verifyAdmin(null, config, keys)).rejects.toBeInstanceOf(AccessDenied);
	});

	it('rejects a valid token for someone who is not an admin', async () => {
		await expect(verifyAdmin(await token({ email: 'cousin@example.com' }), config, keys)).rejects.toThrow(/Not an admin/);
	});

	it('rejects tokens with the wrong audience, issuer or signature, or that have expired', async () => {
		const email = { email: 'ryan@example.com' };
		for (const bad of [
			await token(email, { aud: 'some-other-app' }),
			await token(email, { iss: 'https://evil.cloudflareaccess.com' }),
			await token(email, { key: otherKey }),
			await token(email, { exp: '-1m' }),
			'not-a-jwt',
		]) {
			await expect(verifyAdmin(bad, config, keys)).rejects.toBeInstanceOf(AccessDenied);
		}
	});

	it('rejects a token with no email claim', async () => {
		await expect(verifyAdmin(await token({}), config, keys)).rejects.toBeInstanceOf(AccessDenied);
	});
});

describe('readAccessConfig', () => {
	it('fails loudly when settings are missing', () => {
		expect(() => readAccessConfig({ ACCESS_AUD: 'x', ADMIN_EMAILS: 'a@b.c' })).toThrow(/ACCESS_TEAM_DOMAIN/);
		expect(() => readAccessConfig({ ACCESS_TEAM_DOMAIN: 't', ACCESS_AUD: 'x', ADMIN_EMAILS: ' , ' })).toThrow(
			/no email addresses/,
		);
	});

	it('normalizes the team domain and email list', () => {
		expect(
			readAccessConfig({
				ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com/',
				ACCESS_AUD: ' aud-1 , aud-2 ',
				ADMIN_EMAILS: 'A@x.com, b@x.com',
			}),
		).toEqual({ teamDomain: 'team.cloudflareaccess.com', aud: ['aud-1', 'aud-2'], adminEmails: ['a@x.com', 'b@x.com'] });
	});
});

describe('parseEmailList', () => {
	it('splits on commas and whitespace', () => {
		expect(parseEmailList('a@x.com,b@x.com  c@x.com\n')).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
	});
});
