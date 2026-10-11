# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Jackie & Ryan's site, being turned from a single static wedding page into an AI-assisted life journal. Admins upload photos and notes, an AI model drafts a blog post, and they review and publish it. The full plan, including architecture and phases, is in `docs/journal-plan.md`.

- **Journal:** an Astro app deployed to Cloudflare Workers using the `@astrojs/cloudflare` adapter (`astro.config.mjs`, `wrangler.jsonc`).
- **Wedding page (December 21st, 2025):** the original static site, preserved unchanged in `public/wedding/` and served at `/wedding/`.

## Development Commands

```bash
npm install
npm run dev        # Astro dev server
npm run build      # production build into dist/
npx astro preview  # serve the production build in the local Cloudflare runtime
```

### Deployment
- **Journal:** will deploy to Cloudflare. This is not set up yet; see phase 1 of the plan.
- **GitHub Pages:** `.github/workflows/deploy.yml` deploys the repo root to GitHub Pages on every push to `main`. It still expects the old layout, so do not merge the `journal` branch into `main` until that workflow is retired or updated.

## Architecture

### Journal (`src/`)
- `src/pages/index.astro`: the journal homepage, currently a placeholder that links to `/wedding/`.

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
1. `npm run build` succeeds, and `/` and `/wedding/` load under `npx astro preview`.
2. The wedding page lightbox opens and closes properly on photo click.
3. Mobile responsiveness: hero box positioning and font sizes.
4. The Vimeo video loads and plays.
5. All external links work (RSVP, Maps).
