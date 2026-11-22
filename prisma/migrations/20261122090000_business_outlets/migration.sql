CREATE TABLE "Outlet" ("id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL REFERENCES "Business"("id"), "name" TEXT NOT NULL, "category" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Outlet_businessId_name_key" ON "Outlet"("businessId", "name");
CREATE INDEX "Outlet_businessId_active_idx" ON "Outlet"("businessId", "active");
ALTER TABLE "Stand" ADD COLUMN "outletId" TEXT REFERENCES "Outlet"("id");
ALTER TABLE "StaffMember" ADD COLUMN "outletId" TEXT REFERENCES "Outlet"("id");
ALTER TABLE "AnalyticsEvent" ADD COLUMN "outletId" TEXT REFERENCES "Outlet"("id");
CREATE INDEX "AnalyticsEvent_outletId_createdAt_idx" ON "AnalyticsEvent"("outletId", "createdAt");
