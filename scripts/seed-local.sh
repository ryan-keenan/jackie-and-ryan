#!/usr/bin/env bash
# Loads sample posts into the LOCAL development database and photo storage only
# (Wrangler's --local emulation under .wrangler/state). It never touches the
# deployed site. Re-running it resets the sample data.
#
# Sample data:
#   - "Sample post: Taiwan"  published, public  -> listed on the homepage
#   - "Sample private post"  published, private -> must NOT appear or serve images
#   - "Sample draft"         draft              -> must NOT appear or serve images
# Photos are resized copies of images from public/wedding/images (macOS `sips`).
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=public/wedding/images
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

command -v sips >/dev/null || { echo "seed-local.sh needs macOS 'sips' to resize photos" >&2; exit 1; }

npx wrangler d1 migrations apply DB --local

# photo id | post id | source file
PHOTOS=(
	"seed-rechao|seed-taiwan|taiwan-rechao.jpeg"
	"seed-taipei101|seed-taiwan|taipei-101.jpeg"
	"seed-yongkang|seed-taiwan|yongkang-taipei.jpeg"
	"seed-longdong|seed-taiwan|Longdong.JPG"
	"seed-private|seed-private|eel-in-seoul.jpeg"
	"seed-draft|seed-draft|xc-tahoe.jpeg"
)

for entry in "${PHOTOS[@]}"; do
	IFS='|' read -r photo post file <<<"$entry"
	for size in display:2400 thumb:600; do
		name=${size%%:*}
		px=${size##*:}
		out="$WORK/$photo-$name.jpg"
		sips -s format jpeg -s formatOptions 82 -Z "$px" "$SRC/$file" --out "$out" >/dev/null
		npx wrangler r2 object put "jackie-and-ryan-photos/photos/$post/$photo/$name.jpg" \
			--local --file "$out" --content-type image/jpeg >/dev/null
	done
done

# Real pixel sizes of the display images, so <img> width/height match the files.
dims() { sips -g pixelWidth -g pixelHeight "$WORK/$1-display.jpg" | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print w", "h}'; }

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat >"$WORK/seed.sql" <<SQL
DELETE FROM posts WHERE id LIKE 'seed-%';

INSERT INTO posts (id, slug, title, summary, status, visibility, trip_start, trip_end, location, cover_photo_id, body, author_notes, created_by, published_at, created_at, updated_at)
VALUES
('seed-taiwan', 'sample-taiwan', 'Sample post: Taiwan',
 'Placeholder text for checking the layout. Real posts will be drafted from your notes.',
 'published', 'public', '2026-01-10', '2026-01-18', 'Taiwan', 'seed-rechao',
 '[
   {"type":"paragraph","markdown":"This is **sample content** for testing how a post looks. None of this text describes a real trip; it only exercises each kind of block a post can contain."},
   {"type":"photo","photoId":"seed-rechao"},
   {"type":"heading","text":"A section heading"},
   {"type":"paragraph","markdown":"Paragraphs support Markdown: *italics*, **bold**, and [links](https://www.taiwan.net.tw/) that open in a new tab.\n\nA second paragraph checks spacing between paragraphs. Raw HTML is shown as text, not rendered: <b>not bold</b>."},
   {"type":"gallery","photoIds":["seed-taipei101","seed-yongkang","seed-longdong"]},
   {"type":"quote","text":"A pull quote block, for a line worth highlighting.","attribution":"Sample attribution"},
   {"type":"paragraph","markdown":"Click any photo to open the full-screen viewer. Use the arrow keys or swipe to move between photos, and ESC to close."}
 ]',
 '', 'seed', '$NOW', '$NOW', '$NOW'),
('seed-private', 'sample-private', 'Sample private post', 'Should only be visible to family.',
 'published', 'private', NULL, NULL, '', 'seed-private',
 '[{"type":"photo","photoId":"seed-private"}]', '', 'seed', '$NOW', '$NOW', '$NOW'),
('seed-draft', 'sample-draft', 'Sample draft', 'Should not be visible until published.',
 'draft', 'public', NULL, NULL, '', 'seed-draft',
 '[{"type":"photo","photoId":"seed-draft"}]', '', 'seed', NULL, '$NOW', '$NOW');

INSERT INTO photos (id, post_id, r2_key_original, r2_key_display, r2_key_thumb, width, height, caption, alt, sort_order)
VALUES
('seed-rechao',    'seed-taiwan',  'photos/seed-taiwan/seed-rechao/display.jpg',    'photos/seed-taiwan/seed-rechao/display.jpg',    'photos/seed-taiwan/seed-rechao/thumb.jpg',    $(dims seed-rechao),    'Sample caption for a full-width photo.', 'Rechao, Taiwan', 0),
('seed-taipei101', 'seed-taiwan',  'photos/seed-taiwan/seed-taipei101/display.jpg', 'photos/seed-taiwan/seed-taipei101/display.jpg', 'photos/seed-taiwan/seed-taipei101/thumb.jpg', $(dims seed-taipei101), 'Taipei 101', 'Taipei 101', 1),
('seed-yongkang',  'seed-taiwan',  'photos/seed-taiwan/seed-yongkang/display.jpg',  'photos/seed-taiwan/seed-yongkang/display.jpg',  'photos/seed-taiwan/seed-yongkang/thumb.jpg',  $(dims seed-yongkang),  'Yongkang Street, Taipei', 'Yongkang Street, Taipei', 2),
('seed-longdong',  'seed-taiwan',  'photos/seed-taiwan/seed-longdong/display.jpg',  'photos/seed-taiwan/seed-longdong/display.jpg',  'photos/seed-taiwan/seed-longdong/thumb.jpg',  $(dims seed-longdong),  'Longdong', 'Longdong, Taipei', 3),
('seed-private',   'seed-private', 'photos/seed-private/seed-private/display.jpg',  'photos/seed-private/seed-private/display.jpg',  'photos/seed-private/seed-private/thumb.jpg',  $(dims seed-private),   '', 'Sample private photo', 0),
('seed-draft',     'seed-draft',   'photos/seed-draft/seed-draft/display.jpg',      'photos/seed-draft/seed-draft/display.jpg',      'photos/seed-draft/seed-draft/thumb.jpg',      $(dims seed-draft),     '', 'Sample draft photo', 0);
SQL

npx wrangler d1 execute DB --local --file "$WORK/seed.sql"
echo "Seeded local sample posts. Run 'npm run dev' and open http://localhost:4321/"
