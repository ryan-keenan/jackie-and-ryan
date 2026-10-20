import { handle } from '@astrojs/cloudflare/handler';
import { runJob, type JobMessage } from './lib/ai/job';

// Worker entry point: Astro serves every HTTP request, and the queue consumer
// runs AI drafting and research jobs in the background (a request can't wait minutes for them).
export default {
	fetch: handle,

	async queue(batch: MessageBatch<JobMessage>): Promise<void> {
		for (const message of batch.messages) {
			const outcome = await runJob(message.body, message.attempts);
			if (outcome === 'retry') message.retry({ delaySeconds: 30 * message.attempts });
			else message.ack();
		}
	},
} satisfies ExportedHandler<Env, JobMessage>;
