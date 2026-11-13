-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'SUGGESTION_GENERATE';
ALTER TYPE "EventType" ADD VALUE 'SUGGESTION_REGENERATE';

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandColor" TEXT NOT NULL DEFAULT '#10b981',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "coverImage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "googleMapsUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "internalNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "linkTestedAt" TIMESTAMP(3),
ADD COLUMN     "logo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pincode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "welcomeMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whatsapp" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'INACTIVE';

-- AlterTable
ALTER TABLE "Stand" ADD COLUMN     "lastActivity" TIMESTAMP(3),
ADD COLUMN     "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'NFC_QR',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "dedupKey" TEXT;

-- AlterTable
ALTER TABLE "ReviewPhrase" ADD COLUMN     "sentiment" TEXT NOT NULL DEFAULT 'neutral';

-- CreateTable
CREATE TABLE "ApplicationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "supportEmail" TEXT NOT NULL DEFAULT '',
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminAudit" (
    "actorEmail" TEXT NOT NULL DEFAULT '',
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "Stand_businessId_idx" ON "Stand"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_dedupKey_key" ON "AnalyticsEvent"("dedupKey");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_businessId_createdAt_idx" ON "AnalyticsEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_standId_createdAt_idx" ON "AnalyticsEvent"("standId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewPhrase_category_sentiment_active_idx" ON "ReviewPhrase"("category", "sentiment", "active");
