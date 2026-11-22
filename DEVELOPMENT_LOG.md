# Development Log

## 2026-11-11

- Created initial Next.js 16/Tailwind 4 scaffold.
- Added preliminary Prisma models for businesses, stands, customers, loyalty, transactions, redemptions, review phrases, analytics.
- Added environment example, safety notes and project context.
- Known issues: no implemented APIs/auth/OTP/consent UI; no tests/build run; database migration not executed.
- Next: install dependencies, validate schema, implement verified owner-only auth and business CRUD before customer data collection.

## Phase 1 implementation

- Added Firebase client sign-in and Firebase Admin ID token verification with verified-email ADMIN_EMAILS allowlist.
- Added protected business list/create/update APIs; slug uniqueness, Google HTTPS URL validation and no hard deletion.
- Added responsive owner dashboard, business form, status controls and counts.
- Added shared Prisma client, Firebase helpers, web Firebase environment examples and alias paths.
- Customer-facing flows and OTP are not implemented. Do not enter production customer data until security and deployment verification.

## 2026-11-12 · Phase 2

- Added owner-protected NFC stand list/create/activation APIs and management screen.
- Added public stand lookup and customer-facing editable English review suggestions.
- Added anonymous aggregate copy and Google-click events; removed verbose owner auth debug log.
- No Prisma schema changes or migrations; no database reset.
- Environment secrets excluded from distributable ZIP; restore locally from existing configuration.
- Known limitations: QR artwork, OTP, loyalty, and rate limiting not implemented. Google review submission cannot be verified.

## 2026-11-12 — Complete implementation extension

- Inspected the original ZIP, package lock, schema/init migration, Firebase client/Admin authorization, business/stand CRUD, public routes and prior documentation before implementation. Preserved the stack, original migration, permanent stand codes and optional loyalty entities.
- Added business contact/address/branding fields, verified-link activation workflow, sanitized drag/drop uploads, business/stand editing and search/status/pagination, guarded deletion and reassignment.
- Added 11 category groups, 99 idempotent active-template starter phrases, sentiment-aware experience drafts, regeneration, full editing, one-click copy/continue and manual failure fallback.
- Added PNG/SVG QR downloads, printable stand layout and truthful NTAG213 writing instructions.
- Added distributed rate buckets, bounded bodies, origin validation, URL allowlisting, safe errors, headers, transactional business/stand audit entries, event deduplication, activity timestamps, date-filtered real analytics/charts/reports and settings/retention cleanup.
- Created an additive migration from the original schema without connecting to a live database. Tested preservation of a legacy business and permanent stand code in disposable PostgreSQL/PGlite.
- Found and corrected Zod default application during partial updates; patches now mutate only explicitly supplied keys. Added regression assertions so editing branding cannot silently deactivate a business or re-enable a template.
- Investigated 15 original audit findings. Added explicit grpc-js 1.14.7, deepmerge-ts 8.0.2 and uuid 11.1.1 overrides rather than forcing Firebase/Prisma major changes. Current npm audit reports zero findings. Prisma generation/migration diff/build and used Firebase Admin initialization paths pass; unused Firestore/Storage APIs are not claimed tested.
- Added disposable unit/API integration tests and production-server browser tests. Initial browser attempt could not spawn downloaded Chromium; installed Chrome works through PLAYWRIGHT_CHANNEL=chrome. Test fixtures intercept Google navigation and never post reviews.
- Replaced outdated setup documentation, retained this historical log, added migration/backfill instructions, verification evidence and known launch checks. Complete source package excludes dependencies, builds, secrets and temporary data.
- Live Neon/Firebase/Google listing/NFC/Vercel verification remains outstanding. No deployment or live database action was performed.

- Final audit extension records verified administrator emails for transactional business, stand, template and settings changes. Final checks: 18 unit/integration tests and three Chrome browser tests pass, build/typecheck/Prisma checks pass, audit zero.

## 2026-11-12 - Task 5: premium dashboard and reports, v0.4.0

- Inspected the existing complete project, event schema/writer/deduplication, auth and APIs before changing analytics. Scoped work to requested Task 5; attached Tasks 1-4 are reference context.
- Replaced mixed inventory cards and aggregate-all-events bars with ten explained KPIs, separate inventory/activity scopes, labelled visits/clicks trends, independent-event funnel, rankings, business visit distribution and recent-event timeline.
- Added UTC Today/7-day/30-day/month/custom presets, business/stand/interval filters, explicit pending/applied states, request ordering guard, skeletons, retry and empty states.
- Added dedicated Reports navigation/page and six report tabs. Template usage is clearly unavailable rather than fabricated. Tables support search, sort, pagination, ratios, filtered summary and generation metadata.
- Added owner-only CSV and genuine XLSX exports with all matching rows, safe formula-like strings, metadata, numeric percentages, summary and definitions sheets. Added A4 landscape browser Print / Save PDF with repeated headings and page numbers; rendered all three test-report pages and inspected them. Fixed dark-mode PDF margins and scoped named report pages to preserve QR printing.
- Added a non-destructive date/type index migration, left unapplied to live Neon. Existing data, migrations, deduplication writer, NFC codes, templates and customer review flows remain intact. Aggregate queries run in one repeatable-read transaction and use grouped SQL plus linear entity maps.
- Added independent ExcelJS parsing (test-only), SQL/date/ratio/export tests, responsive report component browser harness outside app/, and retained original review flow browser tests. fflate is the only added production dependency.
- Updated project context, operator/setup/migration notes, known limits, verification report and complete-project ZIP delivery. No live migration, deployment or external analytics service was used.

## 2026-11-13 - v0.4.1 startup / API response repair

- Read supplied npm/Prisma/Next terminal output and screenshots. Migration deploy had succeeded; the import-time Prisma Client initialization failure caused API 500 responses before normal handlers, with secondary JSON parsing errors in the UI.
- Generated Prisma Client 6.19.3 in the user's named Downloads project and verified constructor-only initialization without queries. Did not modify environment files, schema or live data, rerun migrations, or deploy.
- Added an explicit Prisma-before-Next main entry point for dev/build and initialization validation for start, avoiding reliance on dependency install lifecycle scripts.
- Added safe shared API object reading for admin requests, uploads/export errors and public lookup/generation; preserved actionable JSON validation errors and editable review text on failure.
- Updated the seven local runtime files only after comparing them with the delivered Task 5 ZIP. Saved original source copies under work/startup-fix-local-backup.
- Passed 31 unit/integration tests and nine Chrome browser tests. A clean npm ci --ignore-scripts reproduced a missing client; the fixed entry point generated it and started successfully without real environment files or a live database. Production build and TypeScript checks passed.
- Supplied STARTUP_FIX.md and a complete corrected project ZIP. User must restart the already running dev server; no new migration is required.

## 2026-11-16 — v0.5.0 implementation

- Implemented Business Owner access management, assignment/revocation, login/password recovery/email verification, tenant-scoped analytics/reports/QR and owner workspace.
- Added optional category-aware staff configuration, public staff selection, neutral editable name attribution and deduplicated staff-generation counts.
- Redesigned customer page with business-first light branding, contrast-aware buttons and preserved Google/clipboard/error/privacy flows.
- Shared hardened upload/export implementations between separately authorized admin/owner endpoints. Added transaction audit entries for assignments, staff and owner branding/settings changes; setup links are never persisted/logged.
- Added four-table additive migration, pending explicit live-database approval. Isolated migration/integration checks passed; no seed/backfill or real client accounts were created.
- Added real-API/isolated-database browser fixture for owner UI; Firebase provider mocked in fixture only. Production build and initial 40 unit/integration checks passed. Final browser and verification results recorded in TESTING_RESULTS.md.

## v0.5.0 approved production rollout — 2026-11-16

- User explicitly approved the four-table additive live migration and deployment.
- Published application commit `0e6a9d9a80754b955a0082afe1c5933a1095b396` to the existing GitHub main branch; Vercel production deployment `dpl_EJkEUrg2ytrPaAncJGfEwtKfBs2j` reached READY at `https://arvik-smart-reviews.vercel.app`.
- Production preflight matched the configured Firebase project, verified all three previous migration checksums, and confirmed exactly the approved migration was pending. Created a local, gitignored preservation backup of existing business/stand/template/event rows. Credentials and backup data are excluded from deliverables.
- Applied `20261116090000_business_owner_experience` with Prisma migrate deploy against the existing direct Neon endpoint. All four migrations are recorded complete.
- Before/after comparison verified every original row unchanged: 1 business, 1 stand, 99 templates and 24 analytics events. New tables start empty; no test owner/staff/client records, seed, cleanup, backfill or fake review events were inserted.
- Live Chrome smoke checks passed: both login screens, anonymous owner redirect, protected API 401 responses, existing active stand lookup, business-branded mobile/desktop rendering and no browser exceptions/overflow. Production PAGE_VIEW/event requests were intercepted during browser smoke tests to avoid contaminating analytics. No generation/copy/Google-click event was submitted in production.
- Onboarding remains an operational step: Super Admin assigns a real owner under Business Owners; privately delivers a setup link if needed; owner verifies email and adds real staff/enables the question. No live password reset or verification email was sent during deployment verification.

## 2026-11-17 — v0.6.0 implementation

- Reproduced staff-settings resave error from metadata entering strict schema; fixed response DTO and explicit form/save allowlist. Added regression for existing saved settings, disabled selection, blank defaults and custom question.
- Added history-preserving staff Delete endpoint/action and scoped deleted-row exclusions.
- Added yearly Subscription workspace/admin APIs, appended term history, manual payment/void ledger, balance/status calculations and owner read-only status/expiry warning. Public page policy explicitly warning-only per user choice.
- Added Renewal WhatsApp field to business create/edit, Business→Subscription shortcut and manual WhatsApp reminder composer. No message is sent automatically or marked delivered.
- Added/reviewed additive migration and isolated tests. 45 unit/integration checks and 14 browser tests passed; production build passed. No live schema/records were changed during these implementation checks.

### Approved migration execution — 2026-11-17

- Compared the existing Firebase project/Neon target and all four historical migration checksums; confirmed exactly the v0.6.0 migration pending.
- Created a local gitignored preservation backup of business/stand/template/event/owner/config/staff/mention rows; applied only the approved migration.
- Verified all original field values unchanged: 1 / 1 / 99 / 49 / 1 / 1 / 1 / 3 rows respectively. Added column defaults correct; subscription/payment tables empty. No live message, payment, plan or staff deletion was made during verification.

## v0.7.0 — Business outlets (2026-11-22)

Implemented and locally verified. The user approved the live outlet migration and deployment; see release completion notes below.

- Super Admin: Outlets navigation, select business, create/edit/deactivate outlets, assign staff and stand defaults. Owner: Outlets in the assigned business workspace with the same scoped management.
- Customer chooses one outlet or General. All outlets use the existing business Google Review URL; no separate listing or link is created. Existing stand codes and QR URLs stay unchanged. A stand can preselect an active outlet, and the customer can change it.
- Outlet category controls experience options (including Cafe, Bar and Thali); only that outlet's active, undeleted staff are shown when business staff selection is enabled. General staff appear under General. Each staff member currently has one outlet assignment.
- Drafts identify the selected outlet and only use customer-supplied experience and sentiment. Category-specific recorded templates are preferred; Cafe/Bar/Thali fall back to existing active General templates when none exist. No fabricated positive claims. Changing outlet clears generated drafts, selected aspects and staff; the customer's own notes remain.
- Outlet activity table supports Today / Last 7 / Last 30 / This Month in UTC. Counts include generations (with regenerations), copies, outbound Google clicks and attributable page visits. Historical events and visits before outlet selection remain General; these are event counts, not unique customers or published reviews. Existing reports retain their overall totals. Outlet CSV/XLSX exports and multiple staff outlet assignments are not included in this release.
- Normal builds do not apply migrations. No live seeding or external messages were performed. No new dependencies or environment settings.

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

### Approved outlet release operations

Recovered Git push access by selecting the saved GitHub username. Production migration used the existing Vercel production environment, without exporting credentials. Recovered an encrypted preservation backup locally (kept outside Git and ZIP). Original mixed LF/CRLF migration hashes were checked against unchanged Windows originals. A pre-migration deployment was briefly assigned because vercel.json overrode the deployment build override; the prior working production release was immediately restored. The guarded migration applied, then post-DDL cached-plan verification was retried with a fresh connection and backup fingerprints. One-time migration scripts, public encryption key and fingerprints were removed from final source; normal npm run build behavior restored.
