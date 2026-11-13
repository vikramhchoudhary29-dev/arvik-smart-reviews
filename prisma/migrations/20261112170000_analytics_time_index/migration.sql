-- Additive index for date-filtered platform analytics. No data is changed.
CREATE INDEX "AnalyticsEvent_createdAt_type_idx" ON "AnalyticsEvent"("createdAt", "type");
