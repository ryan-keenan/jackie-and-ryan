-- A copy of each photo sized for AI drafting: at most 1568px on the long edge,
-- which stays under the API's 2000px limit for requests with more than 20 images.
-- NULL for photos uploaded before this column existed; drafting refuses those
-- with an error asking for a re-upload rather than sending a different size.
ALTER TABLE photos ADD COLUMN r2_key_ai TEXT;

-- Count draft regenerations and remember the last job's warnings/errors per post.
CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status);
