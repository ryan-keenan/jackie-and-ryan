# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Jackie & Ryan's site, being turned from a single static wedding page into an AI-assisted life journal. Admins upload photos and notes, an AI model drafts a blog post, and they review and publish it. The full plan, including architecture and phases, is in `docs/journal-plan.md`.

- **Journal:** an Astro app deployed to Cloudflare Workers using the `@astrojs/cloudflare` adapter (`astro.config.mjs`, `wrangler.jsonc`).
- **Wedding page (December 21st, 2025):** the original static site, preserved unchanged in `public/wedding/` and served at `/wedding/`.

## Development Commands

```bash
npm install
npm run generate-types  # writes worker-configuration.d.ts (binding types; gitignored)
npm run seed:local      # create the local database and load sample posts (macOS; safe to re-run)
npm run dev             # Astro dev server with local D1 and R2 emulation
npm test                # unit tests (Vitest)
npx astro check         # type check, including .astro files
npm run build           # production build into dist/
npx astro preview       # serve the production build in the local Cloudflare runtime
```

Local data lives in `.wrangler/state` (gitignored) and is shared by `npm run dev`, `astro preview` and `wrangler --local` commands. Nothing local touches the deployed database or photo storage.

### Deployment
- **Journal:** will deploy to Cloudflare. This is not set up yet; see phase 1 of the plan.
- **GitHub Pages:** `.github/workflows/deploy.yml` deploys the repo root to GitHub Pages on every push to `main`. It still expects the old layout, so do not merge the `journal` branch into `main` until that workflow is retired or updated.

## Architecture

### Journal (`src/`)
Every page is rendered on request (`output: 'server'`) from D1, so publishing a post needs no rebuild.

- **Bindings** (`wrangler.jsonc`, read in code via `import { env } from 'cloudflare:workers'`):
  - `DB`: the D1 (Cloudflare SQLite) database. The schema is in `migrations/`.
  - `PHOTOS`: the R2 bucket of photo files, keyed `photos/<post id>/<photo id>/<size>.jpg`.
  - Neither has a cloud ID yet; the first `wrangler deploy` creates them.
- `src/lib/blocks.ts`: the post body format, a JSON array of `heading` / `paragraph` (Markdown) / `photo` / `gallery` / `quote` blocks. `parseBody` validates a body and throws if it references a photo not attached to the post.
- `src/lib/db.ts`: all D1 queries.
- `src/lib/markdown.ts`: Markdown rendering with raw HTML disabled.
- `src/pages/index.astro`: lists published public posts.
- `src/pages/posts/[slug].astro`: a published public post. Drafts and private posts return 404.
- `src/pages/media/[...key].ts`: serves display and thumbnail images from R2, only for published public posts. Originals are never served.
- `src/components/Lightbox.astro`: the full-screen photo viewer, ported from the wedding page. Any element with `data-lightbox-src` opens it.
- `scripts/seed-local.sh`: local sample data, consisting of one public, one private and one draft post.

### Wedding page (`public/wedding/`)
- **index.html:** a single-page layout with a hero section, photo gallery, video embed, and RSVP link.
- **script.js:**
  - Lightbox gallery: click any photo to open it; ESC or a click outside closes it.
  - Fade-in-on-scroll animations, using an Intersection Observer.
  - Parallax scrolling on the hero image.
  - Smooth scrolling for anchor links.
- **styles.css:** a mobile-first responsive layout, with a CSS Grid photo gallery.
- **images/:** wedding photos and the favicon.

All asset paths in the wedding page are relative, so it works from the `/wedding/` subdirectory. The `/wedding` URL redirects to `/wedding/`.

### External Integrations (wedding page)
- **Google Fonts:** Fraunces (headings) and Poppins (body text).
- **Vimeo:** the embedded video player.
- **Google Forms:** the RSVP link.
- **Google Maps:** the venue location link.

## Testing Checklist
When making changes, verify:
1. `npm test`, `npx astro check` and `npm run build` pass. Under `npx astro preview` with seeded data, `/`, `/posts/sample-taiwan` and `/wedding/` load, while `/posts/sample-private`, `/posts/sample-draft` and their `/media/...` images return 404.
2. The wedding page lightbox opens and closes properly on photo click.
3. Mobile responsiveness: hero box positioning and font sizes.
4. The Vimeo video loads and plays.
5. All external links work (RSVP, Maps).
