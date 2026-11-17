-- Additive upgrade. No existing row is deleted, renamed or reassigned.
ALTER TABLE "Business" ADD COLUMN "renewalWhatsapp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StaffMember" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE TABLE "SubscriptionPeriod" (
 "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "startsOn" DATE NOT NULL, "expiresOn" DATE NOT NULL,
 "annualFeePaise" INTEGER NOT NULL, "currency" TEXT NOT NULL DEFAULT 'INR', "notes" TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SubscriptionPeriod_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SubscriptionPeriod_fee_check" CHECK ("annualFeePaise" >= 0),
 CONSTRAINT "SubscriptionPeriod_dates_check" CHECK ("expiresOn" >= "startsOn")
);
CREATE UNIQUE INDEX "SubscriptionPeriod_businessId_startsOn_key" ON "SubscriptionPeriod"("businessId","startsOn");
CREATE INDEX "SubscriptionPeriod_businessId_expiresOn_idx" ON "SubscriptionPeriod"("businessId","expiresOn");
CREATE INDEX "SubscriptionPeriod_expiresOn_idx" ON "SubscriptionPeriod"("expiresOn");
ALTER TABLE "SubscriptionPeriod" ADD CONSTRAINT "SubscriptionPeriod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "SubscriptionPayment" (
 "id" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "amountPaise" INTEGER NOT NULL, "paidOn" DATE NOT NULL,
 "method" TEXT NOT NULL, "reference" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" TIMESTAMP(3), CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SubscriptionPayment_amount_check" CHECK ("amountPaise" > 0)
);
CREATE INDEX "SubscriptionPayment_subscriptionId_voidedAt_idx" ON "SubscriptionPayment"("subscriptionId","voidedAt");
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SubscriptionPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
