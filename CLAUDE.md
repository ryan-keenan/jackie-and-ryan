# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Jackie & Ryan's site, being turned from a single static wedding page into an AI-assisted life journal. Admins upload photos and notes, an AI model drafts a blog post, and they review and publish it. The full plan, including architecture and phases, is in `docs/journal-plan.md`.

- **Journal:** an Astro app deployed to Cloudflare Workers using the `@astrojs/cloudflare` adapter (`astro.config.mjs`, `wrangler.jsonc`).
- **Wedding page (December 21st, 2025):** the original hand-written page, served at `/wedding/` with the journal's site header on top. It is now an archive entry: the countdown and RSVP were removed and the event text is in past tense, but its design, story and photos are unchanged. It appears as a card on the journal homepage.

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
Run `npm run build && npx wrangler deploy` to deploy to Cloudflare Workers. The Worker serves https://jackieandryan.us (www redirects to it) through the `routes` in `wrangler.jsonc`. Public pages (the homepage, published public posts and the wedding page) are open to anyone. Only `/admin` and `/api/admin` are behind a Cloudflare Access login (Google or an emailed one-time code) for the two admins. GitHub Pages is turned off and nothing deploys on push.

## Architecture

### Journal (`src/`)
Every page is rendered on request (`output: 'server'`) from D1, so publishing a post needs no rebuild.

- **Bindings** (`wrangler.jsonc`, read in code via `import { env } from 'cloudflare:workers'`):
  - `DB`: the D1 (Cloudflare SQLite) database. The schema is in `migrations/`.
  - `PHOTOS`: the R2 bucket of photo files, keyed `photos/<post id>/<photo id>/<size>.jpg`.
  - Both exist in Cloudflare. After changing the schema, apply new migrations with `npx wrangler d1 migrations apply DB --remote`.
- `src/lib/blocks.ts`: the post body format, a JSON array of `heading` / `paragraph` (Markdown) / `photo` / `gallery` / `quote` blocks. `parseBody` validates a body and throws if it references a photo not attached to the post.
- `src/lib/db.ts`: all D1 queries.
- `src/lib/markdown.ts`: Markdown rendering with raw HTML disabled.
- `src/pages/index.astro`: the homepage cards, newest first. `src/lib/journal.ts` merges published public posts with `STATIC_ENTRIES`, entries that live outside the database. The wedding page is one of those, dated 2025-12-21 and using `public/journal/wedding-card.jpg`. Posts sort by trip start date, or by publish date if they have none.
- **Site header:** `src/lib/site-header.ts` returns the header as an HTML string, and its styles are in `src/styles/site-header.css`. The journal layout and the wedding page both use these, so the header is defined once.
- **Admin links on public pages:** the middleware sets `locals.isAdmin` on every page. Access doesn't guard public pages, so there it reads the `CF_Authorization` sign-in cookie that Access sets for the whole site (`accessCookieToken` in `src/lib/access.ts`) instead of the `Cf-Access-Jwt-Assertion` header admin pages get. When the visitor is a signed-in admin, the header shows an "Admin" button and post pages show "Edit post", and the page is sent `private, no-cache` so those links are never cached for anyone else.
- `src/pages/posts/[slug].astro`: a published public post. Drafts and private posts return 404.
- `src/pages/media/[...key].ts`: serves display and thumbnail images from R2, only for published public posts. Originals are never served.
- `src/components/Lightbox.astro`: the full-screen photo viewer, ported from the wedding page. Any element with `data-lightbox-src` opens it.
- `scripts/seed-local.sh`: local sample data, consisting of one public, one private and one draft post.

### Admin (`/admin`, `/api/admin`)
- `src/middleware.ts` guards every admin route:
  - In production it verifies the Cloudflare Access JWT (`src/lib/access.ts`) and requires the email to be in `ADMIN_EMAILS`.
  - Non-GET requests must come from the same origin.
  - Responses are marked `no-store`, so drafts and private photos are never cached.
- **Settings:**
  - `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are vars in `wrangler.jsonc`.
  - `ADMIN_EMAILS` is a Worker secret, set with `npx wrangler secret put ADMIN_EMAILS`. It's a secret so the public repo doesn't expose the emails.
  - If any of these is missing, admin requests fail with an error.
- **Local dev:** `npm run dev` has no Access in front of it, so it signs you in as `DEV_ADMIN_EMAIL` from `.dev.vars` (gitignored). That code path only exists in dev builds. A `.dev.vars` file needs:
  ```
  ADMIN_EMAILS=you@example.com
  DEV_ADMIN_EMAIL=you@example.com
  ```
- **Upload flow:** `src/pages/admin/posts/[id].astro` with `src/scripts/admin-upload.ts`.
  - **In the browser:** each photo's EXIF date and GPS are read, HEIC is converted where needed, and a 2400px display JPEG and a 600px thumbnail are produced. Re-encoding strips all metadata.
  - **Upload:** the original plus both JPEGs go to `POST /api/admin/posts/:id/photos`.
  - **Stored:** originals go to R2 but are never served. GPS is kept only in D1, as context for AI drafting.
  - **AI copy:** each upload also produces a 1568px `ai.jpg` copy for drafting. The API limits images to 2000px when a request carries more than 20 of them.

### AI drafting, editing and publishing
- **Starting a draft:** "Generate draft" calls `POST /api/admin/posts/:id/draft`. That creates a row in `jobs` and sends `{ jobId }` to the `DRAFT_QUEUE` Cloudflare Queue.
- **Running the job:** the queue consumer in `src/worker.ts`, the Worker entry point, calls `runDraftJob` in `src/lib/ai/job.ts`. Astro still handles all HTTP requests through `@astrojs/cloudflare/handler`. The admin page polls `GET /api/admin/jobs/:id` for the result.
- **The Claude request** (`src/lib/ai/draft.ts`):
  - It sends one Claude request with every photo's AI copy, labeled `P1`, `P2` and so on, plus the post notes.
  - It asks for structured JSON output (`draftOutputSchema` in `src/lib/ai/schema.ts`). `convertDraft` maps the photo labels back to ids and validates the result against the body format.
  - The model is `DRAFT_MODEL` in `wrangler.jsonc`: `claude-sonnet-5-5`, as confirmed with the owners.
  - Effort is `medium`, and the server-side refusal fallback is on (`fallbacks: "default"`).
  - `ANTHROPIC_API_KEY` is a Worker secret. Locally it lives in `.dev.vars`.
- **Failures:** rate limits and API errors retry up to 3 attempts. Refusals, cut-off replies and unusable output fail the job, with the reason shown on the page. Token usage is recorded on the job.
- **The prompt** is in `src/lib/ai/prompt.ts`. Do not change its wording without the owners' approval.
  - **Research:** facts about what Jackie and Ryan did still come only from their notes and photos. Reviewed research about the place is told in their voice, as they'd explain why the place was worth the trip, but never turned into something they did.
  - **Voice:** it quotes captions and story lines from the wedding page as a voice reference: playful, wry and specific. Captions and text retell the per-photo notes in that voice instead of quoting them, and the text adds what the photos can't show instead of describing them.
  - **Opening photo:** drafts start with a photo block. When a body starts with a photo or gallery, the post page and preview show it right under the title and summary, above the map (`splitOpening` in `src/lib/blocks.ts`).
  - **No example posts:** earlier published posts are not sent as style examples, because the first drafts were written in the flat, descriptive style being replaced. Revisit this once there are posts in the voice they want.
- **Background research (optional, before drafting):** the "Background research" section of the admin post page (`src/components/ResearchPanel.astro`) runs a web research job for public information about the place and activity: its history, what it's famous for, why it's worth the trip. It is not for other people's trip reports. The draft tells it in Jackie and Ryan's voice as part of their story, so they don't have to recap why a place is interesting.
  - **Services:** each run uses Claude with Anthropic's web search tool or Gemini with Grounding with Google Search, picked on the page. Models are the `RESEARCH_CLAUDE_MODEL` and `RESEARCH_GEMINI_MODEL` vars (`claude-sonnet-5-5` and `gemini-4-argon`, confirmed with the owners). `GEMINI_API_KEY` is a Worker secret, and Gemini needs billing enabled on that key's Google project.
  - **Running:** `POST /api/admin/posts/:id/research` queues a job with `kind = 'research'` on the same queue as drafting. `runResearchJob` in `src/lib/ai/job.ts` calls `src/lib/ai/research.ts`, which runs the searches on the provider's side in one request and returns structured JSON. Up to 8 searches per Claude run.
  - **Prompt:** `src/lib/ai/research-prompt.ts`, used by both services. Do not change its wording without the owners' approval. Only trip details and notes are sent, not photos.
  - **Sources (admin only):** every note lists its source URLs so the admins can check it; posts don't show them. Each URL is checked against the pages the searches returned (Claude) or the URLs Gemini cited, and ones that weren't found are shown as "unverified". Gemini cites through temporary Google redirect links, which are replaced by the pages they point to.
  - **Review:** the notes are stored as JSON in `posts.research` (`src/lib/research.ts`). Admins edit or remove them (`PUT`, or `DELETE` for all), and drafting sends whatever is left, labeled R1, R2 and so on.
  - **Google's search suggestions:** Gemini runs return a small HTML snippet of the searches, which Google's terms ask to be shown with grounded results. The admin page shows it in a sandboxed frame.
- **Editing:** the editor (`src/scripts/block-editor.ts`) saves through `PUT /api/admin/posts/:id/content`. Captions are edited under each photo, gallery photo and video in the editor; they save on their own when the box loses focus (`PATCH /api/admin/photos/:id` or `/api/admin/videos/:id`) and stay in sync with the same fields on the photo and video cards. Publishing goes through `POST /api/admin/posts/:id/publish`, which refuses an empty or invalid body. `/admin/posts/:id/preview` shows the last saved version, drafts included.
- **Caching:** public pages send `cache-control: no-cache`, so edits and unpublishing show up on the next visit.

### Maps
- **One pin:** each map shows a single labeled pin on the place the post is about, not every place a photo was taken.
- **Zoom:** each post has a `map_mode`: `off`, `fit`, `city`, `region`, `country` or `world` (`ZOOM` in `src/lib/map.ts`). New posts default to `fit`, "the area around the place": roughly 80 to 150 km across, so the nearest city is in view for orientation.
- **The map pin** (`posts.map_pin`) is map-search text such as "Black Velvet Canyon, Nevada, USA". The text before the first comma labels the pin.
  - **Finding it:** "Find the place" on the admin post page (`POST /api/admin/posts/:id/place`) asks Claude to work out the place from the post's title, Location, dates, notes, photo and video notes, captions and text. No photos are sent. Claude knows most named climbs, trails and landmarks, and can run up to 3 web searches for ones it doesn't. The drafting job also runs it after a draft when the map pin is empty; if that fails, the draft is still saved and the failure is shown with the draft status.
  - **Model and prompt:** the model is the `PLACE_MODEL` var (`claude-sonnet-5-5`, confirmed with the owners). The prompt is in `src/lib/ai/place-prompt.ts`; do not change its wording without the owners' approval.
  - **Looking it up:** saving a changed map pin (or, when it's empty, a changed Location) looks the text up with OpenStreetMap's free Nominatim service (`src/lib/geocode.ts`, called from `src/lib/post-place.ts`) and stores the match in `place_lat`, `place_lon` and `place_name`.
  - If the full text matches nothing, leading comma-separated parts are dropped ("Black Wall, Donner Summit" finds Donner Summit).
  - The admin page shows the matched place, because names are ambiguous ("Eagle Lake, CA" matches one in Tulare County). A more specific pin fixes a wrong match.
  - If the lookup service fails, the save fails with an error rather than keeping a stale place.
  - When nothing is found, the pin goes in the middle of the photos' GPS positions, unlabeled. Phones often strip location when photos are shared, so many uploads have none.
- **Rendering:** `src/lib/map.ts` turns the looked-up place (or the photos' positions) into a map view. `src/components/TripMap.astro` places it under the post title (below an opening photo), and `src/scripts/trip-map.ts` draws it with MapLibre. MapLibre loads only when the map scrolls near view.
- **Styles:** each post also has a `map_style`, one of `MAP_STYLES` in `src/lib/map.ts` (the database CHECK constraint must match; a test enforces it). New and existing posts start with `light`.
  - **Drawn maps:** `light` (OpenFreeMap Positron, warmed to the site palette), `liberty` and `fiord` are OpenFreeMap styles. `light-topo` adds relief shading and contour lines in feet. `old-world` recolors Positron as parchment and ink, and TripMap.astro adds paper grain and a compass rose over it.
  - **Satellite:** `satellite`, `satellite-topo`, `terrain-3d` (tilted, over real elevation) and `globe` (always the whole planet) use EOX Sentinel-2 cloudless imagery. It is 10 m per pixel and licensed CC BY-NC-SA, which allows this non-commercial site; a commercial use would need a different source.
  - **Elevation:** relief, 3D terrain and contours come from AWS Terrain Tiles. `maplibre-contour` computes the contour lines in the browser.
  - None of these needs a key or an account.
- **Choosing a style:** the admin post page has a "Map style" dropdown with previous/next buttons and a live preview that redraws as the style or zoom changes. Changes are kept only after "Save details".
- **Privacy:** positions are rounded to 2 decimal places (about 1 km) before reaching the page, so a pin never marks an exact spot.
- **MapLibre's worker:** it's loaded through `setWorkerUrl` with a Vite `?worker&url` import. Without that, the bundler moves the worker file and the map draws no tiles.

### Video (Cloudflare Stream)
- **Uploading:** the dropzone sends videos to `src/scripts/video-upload.ts`, which uses tus-js-client to upload straight to Stream.
  - The Worker's `POST /api/admin/posts/:id/videos/tus` creates the upload with the API token, inserts a `videos` row, and returns Stream's one-time upload URL in `Location`.
  - When the upload finishes, the browser marks it `processing`. The page then polls `GET /api/admin/videos/:id`, which asks Stream for status until the video is `ready` or `error`.
- **Settings:** `CF_ACCOUNT_ID` is a var in `wrangler.jsonc`. `STREAM_API_TOKEN` (Stream:Edit only) is a secret; locally it goes in `.dev.vars`.
- **Posts:** video blocks (`{ type: 'video', videoId }`) render Stream's iframe player. Publishing refuses a post whose videos aren't `ready`.
- **Access:** videos don't use signed URLs, so anyone with a video's id can play it. That needs revisiting before private posts are viewable.

### Dev server note
After adding a dependency, or when the dev server re-optimizes dependencies, it can fail with "file does not exist ... deps_ssr/handler". Fix it by running `npx astro dev stop`, then `rm -rf node_modules/.vite`, then restarting. Production builds are unaffected.

### Wedding page (`src/wedding/page.html`, `public/wedding/`)
- **How it is served:** Astro's template parser rejects the page's hand-written HTML, so `src/pages/wedding/index.ts` serves `src/wedding/page.html` as a string. It replaces the `<!-- site-header -->` marker with the site header and inlines the header's CSS. The header and the section tabs share one fixed bar.
- **page.html:** a single-page layout with a hero section, event details, the story, a photo gallery, a video embed and a link back to the journal.
- **script.js:**
  - Lightbox gallery: click any photo to open it; ESC or a click outside closes it.
  - Fade-in-on-scroll animations, using an Intersection Observer.
  - Parallax scrolling on the hero image.
  - Smooth scrolling for anchor links.
- **styles.css:** a mobile-first responsive layout, with a CSS Grid photo gallery.
- **images/:** wedding photos and the favicon.

The page's `script.js`, `styles.css` and `images/` stay in `public/wedding/`. Its asset paths are relative, so it only works at `/wedding/`; the route redirects `/wedding` there.

### External Integrations (wedding page)
- **Google Fonts:** Fraunces (headings) and Poppins (body text).
- **Vimeo:** the embedded video player.
- **Google Maps:** the venue location link.

## Testing Checklist
When making changes, verify:
1. `npm test`, `npx astro check` and `npm run build` pass. Under `npx astro preview` with seeded data, `/`, `/posts/sample-taiwan` and `/wedding/` load, while `/posts/sample-private`, `/posts/sample-draft` and their `/media/...` images return 404.
2. The wedding page lightbox opens and closes properly on photo click.
3. Mobile responsiveness: hero box positioning and font sizes.
4. The Vimeo video loads and plays.
5. All external links work (Maps, and the story's LinkedIn links).
