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
