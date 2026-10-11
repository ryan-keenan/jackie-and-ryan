-- Videos are stored and played by Cloudflare Stream; this table links them to posts.
CREATE TABLE videos (
  id            TEXT PRIMARY KEY,
  post_id       TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  -- Stream's id for the video
  stream_uid    TEXT NOT NULL UNIQUE,
  -- uploading: the browser is sending it; processing: Stream is encoding it;
  -- ready: playable; error: Stream couldn't process it (see error)
  status        TEXT NOT NULL CHECK (status IN ('uploading', 'processing', 'ready', 'error')),
  error         TEXT,
  -- Stream's per-account playback host, e.g. customer-abc123.cloudflarestream.com (set once ready)
  playback_host TEXT,
  duration      REAL,
  width         INTEGER,
  height        INTEGER,
  file_name     TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  caption       TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX videos_by_post ON videos (post_id, sort_order);
