# Plan: Turn the wedding site into an AI-assisted life journal

## Context

`jackie-and-ryan` is currently a single static wedding page: `index.html`, `script.js`, `styles.css`, and 117MB of photos in `images/`. GitHub Actions deploys it to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`). It hasn't been updated since the wedding because adding content means hand-editing HTML.

**Goal:** turn it into an online journal that Jackie and Ryan can keep up with almost no effort. Either of them logs in, drops in a batch of trip photos, and writes a few rough notes ("day 2 – hiked to the glacier, Jackie's boots fell apart"). An AI model then drafts a polished blog post with the photos placed and captioned. They skim the draft, tweak it if needed, and publish.

**Decisions so far:**
- **Hosting:** everything runs on Cloudflare.
- **Visibility:** each post is either public or private (family and friends only).
- **Publishing:** the AI writes a draft, a human reviews it, and then it's published. Nothing goes live automatically.
- **Drafting model:** Claude Sonnet 5.5. Before any code is written, the model ID and pricing will be checked against the current Anthropic documentation.

## Architecture

```
Browser (admin)                Cloudflare
───────────────                ─────────────────────────────────────────────
/admin  ──(Cloudflare Access: 2 emails)──►  Astro app on Cloudflare Pages/Workers
  resize photos + read EXIF                   ├─ D1 (SQLite): posts, photos, notes, jobs
  in browser, upload  ────────────────────►   ├─ R2: original + web-sized photos
                                              ├─ Queue consumer → Claude Sonnet 5.5
                                              │    (photos + notes → structured draft)
Public visitor ─► /, /posts/<slug>            └─ serves pages straight from D1 (no rebuild)
Family visitor ─(Access: family email list)─► /family/<slug> + private photo URLs
Anyone ─► /wedding  (existing site, preserved as static files)
```

**Key choices:**
- **Astro with the `@astrojs/cloudflare` adapter, rendering pages on the server.** Posts live in D1 (Cloudflare's SQLite database), so publishing is just a database write. There's no Git commit and no CI rebuild. Public pages are cached at Cloudflare's edge.
- **Cloudflare Access handles login** (Cloudflare's email one-time-PIN or Google login), so no auth code needs to be written.
  - **`/admin/*` and `/api/admin/*`:** one policy, with a two-email allowlist.
  - **`/family/*` and private photo URLs:** a second policy, with a family-and-friends email list that can be edited in the Cloudflare dashboard.
  - **JWT check in the Worker:** Access only enforces these rules on the paths it is configured for. As defense in depth, the Worker also verifies the `Cf-Access-Jwt-Assertion` header (the signed token Access attaches to each request). It rejects any admin or private request without a valid token rather than assuming the path is protected.
- **Photos are resized in the browser before upload.** Each photo gets a ~2400px display version and a ~600px thumbnail; the original is stored too.
  - **EXIF:** the photo's built-in metadata (date taken, GPS location) is read with `exifr` and kept in D1 as context for the AI.
  - **GPS:** published images have GPS removed.
  - **Why the browser:** this avoids paying for Cloudflare Images and keeps uploads fast.
  - **HEIC:** iPhone photos in HEIC format need `heic2any` on desktop Chrome. iOS Safari already converts them to JPEG when uploading.
- **AI drafting runs in the background.** "Generate draft" adds a job to a Cloudflare Queue. A queue consumer sends the notes, photo metadata and resized images (about 1568px on the long edge) to Claude. The admin UI checks the job status until it finishes. Running it this way avoids request timeouts on large batches.
- **Required config fails hard.** If `ANTHROPIC_API_KEY` or the model ID is missing, the job fails with a visible error in the admin UI. It never quietly skips drafting. Secrets are set with `wrangler secret put` (which reads from stdin) and are never committed.

## Data model (D1)

- **`posts`:** `id`, `slug`, `title`, `summary`, `status` (`draft` | `published`), `visibility` (`public` | `private`), `trip_start`, `trip_end`, `location`, `cover_photo_id`, `body` (JSON array of blocks), `author_notes` (the raw notes), `created_by`, `published_at`, `updated_at`.
- **`photos`:** `id`, `post_id`, `r2_key_original`, `r2_key_display`, `r2_key_thumb`, `width`, `height`, `taken_at`, `lat`, `lon`, `caption`, `alt`, `sort_order`, `note` (optional per-photo note: "this is the hut we slept in").
- **`jobs`:** `id`, `post_id`, `status`, `error`, `model`, `input_tokens`, `output_tokens`, `created_at`.

The post body is stored as blocks rather than free-form HTML so the AI's output can be checked against a schema, and so the editor can stay simple. The block types are `heading`, `paragraph` (Markdown), `photo`, `gallery` (2–6 photos) and `quote`.

## AI drafting

- **Input:** the trip notes, the per-photo notes, photos sorted by EXIF time with their timestamps and place names, and the images themselves. GPS coordinates are converted to place names with a free geocoder, or the raw coordinates are sent if geocoding fails.
- **Large batches:** if there are more than about 40 photos, a first pass on the thumbnails picks the highlights. The rest go into an "all photos" gallery at the end of the post.
- **Output:** Claude's structured output or tool use returns JSON that matches the block schema: title, summary, sections, photo placement, captions and alt text. The JSON is validated before it's saved, and invalid output fails the job with a visible error.
- **Voice:** the prompt quotes captions and story lines from the wedding page as its voice reference. Earlier posts were sent as examples at first, but that was stopped in October 2026 because those first drafts were flat and descriptive; it can return once posts are in the voice they want.
- **The prompt is yours.** I'll draft it as a separate file (`src/lib/ai/prompt.ts`) and show you the full text for approval before it's used. After that I won't change it without asking.

## Admin experience

1. **`/admin`:** a list of drafts and published posts, plus a "New post" button.
2. **New post:**
   - Drag and drop photos; they're resized and uploaded with a progress bar.
   - A large notes box for the trip, plus an optional one-line note under each thumbnail.
   - Fields for trip dates and location, which are pre-filled from EXIF.
   - A public/private toggle.
3. **"Generate draft":** a spinner shows while the job runs, and then the editor opens.
4. **Editor:** edit, reorder and delete blocks; swap a photo; choose the cover photo; "Regenerate this section"; edit the title and slug; then Publish.

The existing lightbox code in `script.js` (the click-to-enlarge photo viewer, the ESC/click-outside close handlers, and the fade-in-on-scroll observer) will be reused on post pages.

## Repo restructure

- Scaffold Astro at the repo root.
- Move the current `index.html`, `script.js`, `styles.css` and `images/` into `public/wedding/` unchanged, so `/wedding` keeps working.
- Delete `.playwright-mcp/`: it holds 100+ screenshots from past layout testing sessions and shouldn't be in the repo.
- Retire `.github/workflows/deploy.yml` once Cloudflare Pages Git integration is live. GitHub Pages stays up until DNS is switched.
- Choose a design for the journal homepage: reuse the wedding site's fonts (Fraunces and Poppins) and palette, so the two feel related.

**Key new files:**
- `astro.config.mjs`, `wrangler.toml` (with the D1, R2 and Queue bindings)
- `migrations/0001_init.sql`
- `src/pages/index.astro`, `src/pages/posts/[slug].astro`, `src/pages/family/[slug].astro`
- `src/pages/admin/*`, `src/pages/api/admin/*`
- `src/lib/access.ts` (Access JWT verification), `src/lib/ai/draft.ts`, `src/lib/ai/prompt.ts`, `src/lib/ai/schema.ts`
- `src/components/` (block renderers, gallery, lightbox)

## Phases

1. **Foundation:**
   - Cloudflare account, plus a custom domain (Cloudflare Registrar, ~$10/yr). Per-path Access policies work much better on your own domain than on `*.pages.dev`.
   - Astro scaffold, the wedding page moved to `/wedding`, and the first deploy.
2. **Read side:** the D1 schema, the homepage list, and the post page that renders blocks with the lightbox. Seed one hand-written post to test with.
3. **Admin and uploads:** Access on `/admin`, Worker-side JWT checks, in-browser resize, EXIF extraction and HEIC conversion, uploads to R2, and post creation.
4. **AI drafting:** the queue job and the Claude call. Before this phase starts: confirm the model ID and pricing, and get the prompt approved.
5. **Editor and publish:** the block editor, regenerate-section, and publish.
6. **Private posts:** the `/family` route, the second Access policy, and private photos served through a Worker that checks the visitor's Access token. Public photos come straight from R2.
7. **Later, optional:**
   - An RSS feed and a map of where posts were written.
   - "Email photos to post@yourdomain" via Cloudflare Email Workers.
   - Importing from a Google Photos or iCloud shared album.
   - A yearly "book" export to PDF.

## Cost estimate (to verify during phase 1)

- **Pages, D1 and Access:** free at this scale. Access is free for up to 50 users.
- **R2:** 10GB free, then about $0.015/GB-month, with no download (egress) fees.
- **Queues:** may require the Workers Paid plan ($5/month).
- **Claude:** a 30-photo post is very roughly 50–80k input tokens. Real per-post costs will be logged to the `jobs` table.

## Verification

- **Local:** run the app with `wrangler dev` (or `astro dev` with the Cloudflare platform proxy), which provides local D1, R2 and Queue emulation. Apply migrations to the local D1.
- **Unit tests (Vitest):**
  - The Access JWT verifier rejects missing, expired and wrong-audience tokens.
  - Block-schema validation rejects malformed AI output.
  - The draft job fails loudly when `ANTHROPIC_API_KEY` is unset.
- **End-to-end (Playwright, in a real browser):**
  - Upload 5 sample photos with notes, generate a draft against the real API, edit one block, publish, and check that `/posts/<slug>` renders and the lightbox works.
  - A private post returns an Access challenge or a 403 for an anonymous visitor.
  - `/wedding` still renders correctly on desktop and mobile, following the checklist in `CLAUDE.md`.
- **Staging:** deploy to a Cloudflare Pages preview branch first, test the Access policies with a non-admin email, then promote to production and point DNS at it.
