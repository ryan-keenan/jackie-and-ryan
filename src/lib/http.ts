import type { z } from 'astro/zod';

/** A request the client got wrong; the message is shown to the admin. */
export class BadRequest extends Error {
	constructor(
		message: string,
		readonly status = 400,
	) {
		super(message);
	}
}

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/** Runs an API handler, turning BadRequest into a JSON error response. Anything else propagates as a 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof BadRequest) return json({ error: error.message }, error.status);
		throw error;
	}
}

export function parseWith<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
	const result = schema.safeParse(data);
	if (!result.success) {
		const details = result.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`);
		throw new BadRequest(`Invalid input. ${details.join('; ')}`);
	}
	return result.data;
}

export async function readJson(request: Request): Promise<unknown> {
	if (!request.headers.get('content-type')?.includes('application/json')) {
		throw new BadRequest('Expected a JSON request body', 415);
	}
	try {
		return await request.json();
	} catch {
		throw new BadRequest('Request body is not valid JSON');
	}
}
