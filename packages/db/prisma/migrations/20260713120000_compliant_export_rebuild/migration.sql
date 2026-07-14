-- Compliant export rebuild:
--  * Instagram session token becomes unused & nullable (no more cookie storage)
--  * Ghost scoring columns renamed to honest compliant dimensions
--  * Add follow/engagement timestamps derived from the data export

-- 1. Session token fields are no longer written; make them nullable.
ALTER TABLE "instagram_accounts" ALTER COLUMN "session_token_encrypted" DROP NOT NULL;
ALTER TABLE "instagram_accounts" ALTER COLUMN "session_token_iv" DROP NOT NULL;

-- 2. Rename ghost scoring columns to compliant dimensions.
ALTER TABLE "ghosts" RENAME COLUMN "score_account_type" TO "score_close_friend";
ALTER TABLE "ghosts" RENAME COLUMN "score_ratio" TO "score_reciprocity";
ALTER TABLE "ghosts" RENAME COLUMN "score_size_band" TO "score_follow_recency";
ALTER TABLE "ghosts" RENAME COLUMN "score_post_recency" TO "score_engagement_recency";
-- score_engagement keeps its name (now: likes + comments you gave them).

-- 3. New signals sourced from the export.
ALTER TABLE "ghosts" ADD COLUMN "followed_at" TIMESTAMP(3);
ALTER TABLE "ghosts" ADD COLUMN "last_engaged_at" TIMESTAMP(3);
ALTER TABLE "ghosts" ADD COLUMN "is_close_friend" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ghosts" ADD COLUMN "likes_given" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ghosts" ADD COLUMN "comments_given" INTEGER NOT NULL DEFAULT 0;
