import { handle } from '@astrojs/cloudflare/handler';
import { runDraftJob, type DraftJobMessage } from './lib/ai/job';

// Worker entry point: Astro serves every HTTP request, and the queue consumer
// runs AI drafting jobs in the background (a request can't wait minutes for Claude).
export default {
	fetch: handle,

	async queue(batch: MessageBatch<DraftJobMessage>): Promise<void> {
		for (const message of batch.messages) {
			const outcome = await runDraftJob(message.body.jobId, message.attempts);
			if (outcome === 'retry') message.retry({ delaySeconds: 30 * message.attempts });
			else message.ack();
		}
	},
} satisfies ExportedHandler<Env, DraftJobMessage>;
