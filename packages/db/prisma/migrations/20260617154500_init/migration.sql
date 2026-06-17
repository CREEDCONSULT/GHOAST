-- CreateEnum
CREATE TYPE "user_tier" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');

-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('PERSONAL', 'CREATOR', 'BRAND', 'CELEBRITY');

-- CreateEnum
CREATE TYPE "queue_job_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('PURCHASE', 'CONSUME', 'REFUND');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "tier" "user_tier" NOT NULL DEFAULT 'FREE',
    "stripe_customer_id" TEXT,
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instagram_user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "profile_pic_url" TEXT,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "session_token_encrypted" TEXT NOT NULL,
    "session_token_iv" TEXT NOT NULL,
    "last_scanned_at" TIMESTAMP(3),
    "queue_paused" BOOLEAN NOT NULL DEFAULT false,
    "pending_disconnect" BOOLEAN NOT NULL DEFAULT false,
    "disconnect_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ghosts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "instagram_user_id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "profile_pic_url" TEXT,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "account_type" "account_type" NOT NULL DEFAULT 'PERSONAL',
    "last_post_date" TIMESTAMP(3),
    "priority_score" INTEGER NOT NULL,
    "tier" INTEGER NOT NULL,
    "score_account_type" INTEGER NOT NULL DEFAULT 0,
    "score_ratio" INTEGER NOT NULL DEFAULT 0,
    "score_engagement" INTEGER NOT NULL DEFAULT 0,
    "score_size_band" INTEGER NOT NULL DEFAULT 0,
    "score_post_recency" INTEGER NOT NULL DEFAULT 0,
    "engagement_unknown" BOOLEAN NOT NULL DEFAULT false,
    "is_whitelisted" BOOLEAN NOT NULL DEFAULT false,
    "removed_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unfollow_queue_jobs" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "ghost_id" TEXT NOT NULL,
    "bullmq_job_id" TEXT,
    "status" "queue_job_status" NOT NULL DEFAULT 'PENDING',
    "credit_used" BOOLEAN NOT NULL DEFAULT false,
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "unfollow_queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_sessions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "unfollow_count" INTEGER NOT NULL DEFAULT 0,
    "rate_limit_hits" INTEGER NOT NULL DEFAULT 0,
    "paused_until" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "followers_count" INTEGER NOT NULL,
    "following_count" INTEGER NOT NULL,
    "ghost_count" INTEGER NOT NULL,
    "ratio" DOUBLE PRECISION NOT NULL,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "transaction_type" NOT NULL,
    "credits_added" INTEGER,
    "credits_consumed" INTEGER,
    "balance_after" INTEGER NOT NULL,
    "pack_type" TEXT,
    "price_paid_cents" INTEGER,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "tier" "user_tier" NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "instagram_accounts_user_id_idx" ON "instagram_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_accounts_user_id_instagram_user_id_key" ON "instagram_accounts"("user_id", "instagram_user_id");

-- CreateIndex
CREATE INDEX "ghosts_account_id_tier_priority_score_idx" ON "ghosts"("account_id", "tier", "priority_score");

-- CreateIndex
CREATE INDEX "ghosts_account_id_removed_at_idx" ON "ghosts"("account_id", "removed_at");

-- CreateIndex
CREATE UNIQUE INDEX "ghosts_account_id_instagram_user_id_key" ON "ghosts"("account_id", "instagram_user_id");

-- CreateIndex
CREATE INDEX "unfollow_queue_jobs_account_id_status_idx" ON "unfollow_queue_jobs"("account_id", "status");

-- CreateIndex
CREATE INDEX "unfollow_queue_jobs_account_id_created_at_idx" ON "unfollow_queue_jobs"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "queue_sessions_account_id_idx" ON "queue_sessions"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "queue_sessions_account_id_date_key" ON "queue_sessions"("account_id", "date");

-- CreateIndex
CREATE INDEX "account_snapshots_account_id_taken_at_idx" ON "account_snapshots"("account_id", "taken_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_stripe_payment_intent_id_key" ON "credit_transactions"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ghosts" ADD CONSTRAINT "ghosts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unfollow_queue_jobs" ADD CONSTRAINT "unfollow_queue_jobs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unfollow_queue_jobs" ADD CONSTRAINT "unfollow_queue_jobs_ghost_id_fkey" FOREIGN KEY ("ghost_id") REFERENCES "ghosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_sessions" ADD CONSTRAINT "queue_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
