-- Additive only: no existing table, stand code, template or analytics row is modified.
CREATE TABLE "BusinessOwner" (
 "id" TEXT NOT NULL, "firebaseUid" TEXT NOT NULL, "email" TEXT NOT NULL,
 "businessId" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BusinessOwner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BusinessOwner_firebaseUid_businessId_key" ON "BusinessOwner"("firebaseUid","businessId");
CREATE INDEX "BusinessOwner_firebaseUid_active_idx" ON "BusinessOwner"("firebaseUid","active");
CREATE INDEX "BusinessOwner_businessId_idx" ON "BusinessOwner"("businessId");
ALTER TABLE "BusinessOwner" ADD CONSTRAINT "BusinessOwner_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "BusinessExperience" (
 "businessId" TEXT NOT NULL, "staffEnabled" BOOLEAN NOT NULL DEFAULT false,
 "staffQuestion" TEXT NOT NULL DEFAULT '', "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "BusinessExperience_pkey" PRIMARY KEY ("businessId")
);
ALTER TABLE "BusinessExperience" ADD CONSTRAINT "BusinessExperience_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "StaffMember" (
 "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT '',
 "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffMember_businessId_active_idx" ON "StaffMember"("businessId","active");
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "StaffMention" (
 "id" TEXT NOT NULL, "dedupKey" TEXT NOT NULL, "businessId" TEXT NOT NULL, "standId" TEXT NOT NULL,
 "staffId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StaffMention_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StaffMention_dedupKey_key" ON "StaffMention"("dedupKey");
CREATE INDEX "StaffMention_businessId_createdAt_idx" ON "StaffMention"("businessId","createdAt");
CREATE INDEX "StaffMention_staffId_createdAt_idx" ON "StaffMention"("staffId","createdAt");
ALTER TABLE "StaffMention" ADD CONSTRAINT "StaffMention_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
