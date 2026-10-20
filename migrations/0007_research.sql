-- Web research for AI drafting. A research job looks up the post's place and
-- activity on the web; the admins review the notes, and drafting uses what's left.
-- research: JSON (shape in src/lib/research.ts), or NULL when never researched.
ALTER TABLE posts ADD COLUMN research TEXT;
-- Sources of the research the published text uses, listed at the end of the post:
-- JSON array of { url, title }.
ALTER TABLE posts ADD COLUMN sources TEXT NOT NULL DEFAULT '[]';
-- Jobs are either drafts or research runs; web_searches counts billed searches.
ALTER TABLE jobs ADD COLUMN kind TEXT NOT NULL DEFAULT 'draft' CHECK (kind IN ('draft', 'research'));
ALTER TABLE jobs ADD COLUMN web_searches INTEGER;
