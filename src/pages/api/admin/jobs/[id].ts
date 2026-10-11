import type { APIRoute } from 'astro';
import { getJob } from '../../../../lib/db';
import { BadRequest, handle, json } from '../../../../lib/http';

export const GET: APIRoute = ({ params }) =>
	handle(async () => {
		const job = await getJob(params.id!);
		if (!job) throw new BadRequest('Job not found', 404);
		return json(job);
	});
