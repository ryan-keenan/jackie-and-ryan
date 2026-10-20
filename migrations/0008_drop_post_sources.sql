-- Posts no longer list research sources: research is told as part of the
-- story, and its sources are only shown to the admins while reviewing it.
ALTER TABLE posts DROP COLUMN sources;
