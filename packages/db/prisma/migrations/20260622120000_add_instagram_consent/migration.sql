ALTER TABLE "instagram_accounts"
ADD COLUMN "consent_version" TEXT,
ADD COLUMN "consent_accepted_at" TIMESTAMP(3);
