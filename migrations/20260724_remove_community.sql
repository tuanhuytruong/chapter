-- Remove retired Community / Book Club data and schema.
-- This intentionally deletes historical community posts and comments.
BEGIN;

DROP TABLE IF EXISTS chapter.community_comments;
DROP TABLE IF EXISTS chapter.community_posts;

COMMIT;

SELECT
  to_regclass('chapter.community_posts') AS community_posts,
  to_regclass('chapter.community_comments') AS community_comments;
-- Expected: both NULL.
