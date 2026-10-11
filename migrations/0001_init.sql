-- Journal schema: posts, their photos, and AI drafting jobs.
-- Timestamps are ISO 8601 UTC strings; trip dates are YYYY-MM-DD.

CREATE TABLE posts (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  summary        TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  visibility     TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  trip_start     TEXT,
  trip_end       TEXT,
  location       TEXT NOT NULL DEFAULT '',
  cover_photo_id TEXT,
  -- JSON array of content blocks; shape is defined and validated in src/lib/blocks.ts
  body           TEXT NOT NULL DEFAULT '[]',
  -- The admins' raw trip notes, kept as input for AI drafting
  author_notes   TEXT NOT NULL DEFAULT '',
  created_by     TEXT NOT NULL,
  published_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  -- A published post must have a publish time
  CHECK (status = 'draft' OR published_at IS NOT NULL)
);

CREATE INDEX posts_listing ON posts (status, visibility, published_at DESC);

CREATE TABLE photos (
  id              TEXT PRIMARY KEY,
  post_id         TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  r2_key_original TEXT NOT NULL,
  r2_key_display  TEXT NOT NULL,
  r2_key_thumb    TEXT NOT NULL,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  taken_at        TEXT,
  lat             REAL,
  lon             REAL,
  caption         TEXT NOT NULL DEFAULT '',
  alt             TEXT NOT NULL DEFAULT '',
  -- Optional one-line note from the admin about this photo, used by AI drafting
  note            TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX photos_by_post ON photos (post_id, sort_order);
CREATE UNIQUE INDEX photos_display_key ON photos (r2_key_display);
CREATE UNIQUE INDEX photos_thumb_key ON photos (r2_key_thumb);

CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,
  post_id       TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  error         TEXT,
  model         TEXT NOT NULL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX jobs_by_post ON jobs (post_id, created_at DESC);
