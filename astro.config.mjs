// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Pages read posts from D1 on each request, so publishing needs no rebuild.
  output: 'server',
  // Login is handled by Cloudflare Access, not Astro sessions, so no session KV store.
  session: false,
  adapter: cloudflare({
    // Photos are resized in the browser before upload; no Cloudflare Images service.
    imageService: 'passthrough',
  }),
});
