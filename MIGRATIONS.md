# Database migration instructions

No live database was accessed or modified for this delivery. Do not reset databases or delete migration history. Prisma remains pinned to 6.19.3.

## Before approval

Review prisma/migrations/20261112090000_complete_reviews/migration.sql and the actual target migration history. Take a restorable backup. Test on an isolated Neon branch first. The supplied original init migration must already be present in the target history; if the database was created with db push or has drift, inspect and reconcile its baseline manually rather than blindly resolving migrations. Do not mark an unapplied migration as applied.

The incremental migration is additive except for changing the default status for **new** Business rows to INACTIVE. Existing business statuses, IDs, codes, relationships, loyalty records and analytics remain intact. Added fields use safe defaults or nullable values. No tables or columns are dropped. PostgreSQL 12+ is required for adding the two enum variants in this migration; Neon satisfies this requirement.

## Approved migration commands (PowerShell)

From the extracted project directory, with Node.js 24 and the reviewed .env configuration:

```powershell
npm ci
npx prisma generate
# Assign only the APPROVED target's DIRECT Neon endpoint; never paste it into chat.
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@DIRECT_HOST/DB?sslmode=require'
npx prisma migrate status
npx prisma migrate deploy
npm run seed
npx prisma migrate status
Remove-Item Env:DATABASE_URL
```

Replace the placeholder endpoint locally. The explicit shell value overrides .env. Removing it restores the .env/application URL for later commands. Stop immediately if migrate deploy reports an error; inspect the migration state and database before retrying. Do not use migrate reset, db push or automatic destructive recovery. No production commands above have been run by this task.

The seed inserts 99 stable-ID starter phrases only when absent. It never overwrites existing phrase edits or active states. It does not create fake client businesses or stands.

## Required existing-data review / backfill

1. Existing Business rows have category=general, empty contact/branding fields and linkTestedAt=NULL. Existing stand URLs/codes remain identical, but public lookup now requires confirmation. Plan this transition so administrators can re-certify businesses before public use.
2. In the admin business editor, set the correct category and branding, open the stored Google link and verify the right business review form, then check the explicit confirmation and save. Ordinary Maps listing URLs must be replaced with a supported review-form URL. Do not bulk-mark untested links as confirmed.
3. Existing ReviewPhrase rows default to sentiment=neutral. Review any old positive-only or fabricated phrases and classify, edit or disable them before enabling public use. Category keys are hotel, restaurant, optical, jewellery, salon, clinic, retail, automobile, education, professional and general. Resorts/cafes/spas use their corresponding shared category.
4. Existing Stand rows default to type=NFC_QR and location empty; set their actual type/location. The new updatedAt initially reflects migration time. lastActivity remains NULL until a new interaction. Historical rows retain their original timestamps.
5. Existing events have dedupKey=NULL and are preserved. New events use unique stand/type/event-ID keys. Old duplicate data is not silently removed. New indexes support business and stand date reports.
6. Verify the public URL, Google destination, event totals and QR for one business before rolling out the remainder. Migration SQL was tested on disposable PGlite/PostgreSQL, not on your live Neon instance.

## Rollback / recovery

Prefer a forward corrective migration. Do not remove migration rows or drop new tables to simulate rollback. If an approved migration fails, use its Prisma error and database state to plan repair with the database administrator. Restore the verified backup/Neon branch if necessary under your own approved recovery process. Preserve the original ZIP and deployment artifact before upgrading. Once the new public API is in use, reverting old code can reintroduce unsafe URL validation and remove confirmation checks; evaluate that behavior explicitly.

## Task 5 / v0.4.0 index-only upgrade from v0.3.0

The only new migration for Task 5 is 20261112170000_analytics_time_index. It creates AnalyticsEvent_createdAt_type_idx on (createdAt,type) to support platform-wide date-range scans. It contains no DROP, DELETE, UPDATE or data backfill. Business/stand IDs, codes, template records, stored review URLs and existing link confirmations are not changed. No re-confirmation is needed when upgrading an already configured v0.3.0 installation.

Review the SQL, test it on an isolated Neon branch, back up and obtain approval before applying to live Neon. Use the same approved direct-endpoint migrate status / migrate deploy procedure above. The standard CREATE INDEX can temporarily block writes and consumes index storage on large tables; plan the approved migration window based on the real table size. No live query plan/load test or production index build was performed here. Local tests apply all three migration files to disposable PostgreSQL/PGlite instances.

## v0.5.0 — additive Business Owner and staff migration

Migration: `prisma/migrations/20261116090000_business_owner_experience/migration.sql`.

Adds **only four new tables** and their indexes/foreign keys: BusinessOwner (Firebase UID/business assignments), BusinessExperience (optional staff-question settings), StaffMember (display names/roles/status) and StaffMention (deduplicated generation attribution). No existing columns are changed. No DROP, DELETE, UPDATE or data backfill is included. No owner account, staff entry or fake analytics is seeded. Staff starts disabled by default.

Reviewed and exercised on disposable PostgreSQL/PGlite by owner integration tests, including legacy code preservation and migration-pending public fallback. Live execution requires explicit user approval and an existing backup/recovery point. Do not reset the database or run `db push`. Do not re-run old initialisation SQL manually.

```powershell
# Configure DATABASE_URL locally to the APPROVED target; never paste it into chat.
npx prisma migrate status
# Confirm that only 20261116090000_business_owner_experience is pending.
npx prisma migrate deploy
npx prisma migrate status
```

Stop if older migrations are pending, Prisma reports drift/failed migrations, or the target is not the intended database. Resolve the actual state before continuing. No seed command is required. The app does not auto-run migrations during build/deploy. Do not include `.env*`, `.vercel` or database backups in ZIPs.

After migration: sign in as Super Admin → Business Owners → grant access → privately deliver a setup link if needed. Owner verifies email and signs in → Staff → add real staff and enable selection. Test one existing NFC URL, including critical feedback and manual clipboard fallback. Do not create fake client data to test production.

Code is backward compatible with the previous schema for existing public review pages: missing new config tables disable staff selection; new feature routes show 503. Roll back application code if needed without dropping the new tables or deleting historical mentions. Cleanup applies the configured event-retention window to staff mentions too; it is an explicit maintenance command, never run as part of this upgrade.

### Production activation — 2026-11-16

The user approved and the task applied `20261116090000_business_owner_experience` to the existing production Neon database. All four migrations are complete. Existing business, stand/code, template and event rows were compared before/after and are unchanged. Do not re-run initialisation SQL or seed for this upgrade. The four new tables start empty; assign a real owner through the Super Admin UI to begin onboarding.

## v0.6.0 migration — yearly subscriptions and staff deletion

Review `prisma/migrations/20261117090000_yearly_subscriptions_staff_removal/migration.sql`.

- Adds `Business.renewalWhatsapp` (empty string default) and nullable `StaffMember.deletedAt` (null for all existing staff).
- Adds `SubscriptionPeriod` and `SubscriptionPayment`, with indexes, date/amount checks and restrictive foreign keys. New tables start empty. No price, plan, expiry, payment, removal, change to existing settings, template or historical analytics is backfilled.
- Approved rollout order: preservation backup/check existing migration checksums → confirm exactly this migration pending → `npx prisma migrate deploy` → verify original records/stand codes remain unchanged → deploy the updated code. No `db push`, reset, seed, cleanup or manual UPDATE/DELETE is part of the upgrade.
- This version expects new columns on Business/StaffMember; migrate **before** activating the new code. Older v0.5.0 code tolerates the additive columns/tables while the new deployment builds. Rollback application code without dropping the new tables or erasing subscription/payment history.
- Staff Delete is a user-triggered soft removal, not a migration action. Expiry warnings are computed from dates; no background job deactivates businesses/stands.

### v0.6.0 approved live migration — 2026-11-17

User approved and migration `20261117090000_yearly_subscriptions_staff_removal` was applied before code rollout. All five migrations completed. Verified every original field value preserved across 1 business, 1 stand, 99 templates, 49 events, 1 owner assignment, 1 experience config, 1 staff record and 3 mentions. New period/payment tables remain empty; added renewal contact is blank and deletedAt null. No price/payment/plan/contact/removal was backfilled. Do not rerun initialization/seed or delete migration records.

## v0.7.0 — Business outlets (2026-11-22)

Implemented locally; live database migration and deployment await explicit approval for this update.

- Super Admin: Outlets navigation, select business, create/edit/deactivate outlets, assign staff and stand defaults. Owner: Outlets in the assigned business workspace with the same scoped management.
- Customer chooses one outlet or General. All outlets use the existing business Google Review URL; no separate listing or link is created. Existing stand codes and QR URLs stay unchanged. A stand can preselect an active outlet, and the customer can change it.
- Outlet category controls experience options (including Cafe, Bar and Thali); only that outlet's active, undeleted staff are shown when business staff selection is enabled. General staff appear under General. Each staff member currently has one outlet assignment.
- Drafts identify the selected outlet and only use customer-supplied experience and sentiment. Category-specific recorded templates are preferred; Cafe/Bar/Thali fall back to existing active General templates when none exist. No fabricated positive claims. Changing outlet clears generated drafts, selected aspects and staff; the customer's own notes remain.
- Outlet activity table supports Today / Last 7 / Last 30 / This Month in UTC. Counts include generations (with regenerations), copies, outbound Google clicks and attributable page visits. Historical events and visits before outlet selection remain General; these are event counts, not unique customers or published reviews. Existing reports retain their overall totals. Outlet CSV/XLSX exports and multiple staff outlet assignments are not included in this release.
- No automatic migration, seeding, external messages or deployment occurred. No new dependencies or environment settings.

### Migration order

Back up the intended database. Review prisma/migrations/20261122090000_business_outlets/migration.sql. It creates Outlet and adds nullable outletId to Stand, StaffMember and AnalyticsEvent, with foreign keys and indexes. It does not update/delete existing rows or backfill historical outlet attribution. Apply migration before running the new application.

PowerShell in the extracted project, with development .env configured:

```powershell
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
npm run dev
```

Do not run migration commands against the live database until approved. Seeding is optional for a fresh development database (npm run seed); no live seed is required because existing General templates supply fallback wording.
