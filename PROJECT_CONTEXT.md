# Project context — Arvik Smart Reviews

Updated 12 November 2026. Owner: Arvik Digital. Centrally managed one-time commercial service; public customers do not sign in. No subscription, paid AI, review incentives or Google submission automation.

## Architecture

Next.js 16.4.6 App Router and React 19, Tailwind CSS 4 plus shared responsive CSS. Firebase web email/password login is preserved. Firebase Admin verifies revoked ID tokens, verified email and ADMIN_EMAILS allowlist on protected APIs. Prisma client/CLI remain exactly 6.19.3 against PostgreSQL/Neon; hosting preparation targets Vercel and HTTPS.

- app/admin/login: existing Firebase login. components/admin.tsx: protected responsive shell and business/stand/template managers. components/reports.tsx: dashboard, analytics and settings.
- app/r/[code]: branded mobile customer flow, experience/sentiment input, active stored-phrase suggestions, editing, one-button clipboard plus same-tab Google navigation and manual fallback.
- lib/validation.ts: strict Zod schemas, reviewed Google host/path rules, safe image paths and patch-only-field parsing. lib/http.ts: safe API errors, origin checks, bounded body reads, distributed minute rate limits and active stand resolution.
- lib/review-suggestions.ts: three English drafts derived from declared aspects and customer notes only. lib/seed.ts: 99 idempotent starter phrases across 11 category groups.
- lib/events.ts: privacy-conscious events with per-stand/type/event-ID deduplication and last activity. Admin analytics aggregates real database events over UTC date ranges. Counts are not successful Google reviews or verified unique people.
- /api/admin/*: protected CRUD, analytics, settings, images and QR exports. /api/public/stand/[code]: public branding; /suggestions generates drafts; /event records allowed events. /api/media/[id] serves sanitized public branding images.
- QR PNG/SVG exports use the configured NEXT_PUBLIC_APP_URL and permanent random stand code. Print layout and NTAG213 writing guidance are in the stand UI.

## Data model

Preserves Business, Stand, Customer, LoyaltyProgram, StampTransaction, RewardRedemption, AnalyticsEvent and ReviewPhrase. Adds Business contact/branding/category/link-test fields, Stand metadata/activity, generation event variants, event dedup/indexes and phrase sentiment. New ApplicationSettings, MediaAsset, RateLimit and AdminAudit tables support operations. Uploaded images are sanitized WebP bytes in PostgreSQL. Existing loyalty data is retained; no new loyalty API or incentives are implemented.

Original init migration is preserved. The incremental complete_reviews migration must be reviewed and approved before live use. Existing business links require real administrator testing and confirmation after upgrade; their stand codes are preserved.

## Configuration and operations

.env.example has every required variable without credentials. Node 24 LTS is the documented runtime. Set the permanent HTTPS NEXT_PUBLIC_APP_URL before manufacturing stands. Firebase client variables are public build-time identifiers; Firebase Admin and DATABASE_URL are server secrets. RATE_LIMIT_SECRET protects keyed IP hashes. Use a trustworthy hosting proxy; direct public deployments need their own appropriate proxy/IP policy.

README.md contains exact commands and deployment/NFC instructions. MIGRATIONS.md covers backup, direct Neon endpoint, migrate deploy and backfill. npm run cleanup applies configured analytics retention and removes expired rate-limit rows; schedule it only in an approved environment. No deployment, scheduler or live migration was performed.

## Verification boundary

Local TypeScript/build/tests/audit and mobile browser flow evidence are in TESTING_RESULTS.md and verification/. In-memory PGlite is a test-only PostgreSQL implementation, not a database replacement. The Firebase token verifier is stubbed only in integration tests. No real Firebase owner sign-in, Neon networking, Google listing interaction, NFC hardware or Vercel deployment has been verified. Production readiness remains conditional on those checks and operational/privacy review.

## Task 5 - v0.4.0 dashboard and report extension

- Ten individually described KPIs separate platform-wide current inventory from UTC date/entity-filtered activity. Google CTR is an event ratio; zero denominator is N/A and repeated clicks can exceed 100%.
- components/analytics-workspace.tsx and analytics-charts.tsx provide responsive dashboard visuals, presets, scoped summaries, timelines, report tabs, sorting/search, loading/errors and A4 printing. components/reports.tsx is the protected wrapper; settings moved unchanged to components/settings.tsx. /admin/reports is added; /admin/analytics remains.
- lib/analytics-filters.ts validates inclusive UTC dates, Monday weeks and zero-filled periods. analytics-model.ts shares report calculations. analytics-server.ts uses parameterized, indexed aggregates in a repeatable-read transaction and preserves legacy response fields. report-export.ts writes protected CSV and genuine three-sheet XLSX exports through /api/admin/reports.
- Only schema change: additive AnalyticsEvent(createdAt,type) index in 20261112170000_analytics_time_index. No migrations deployed and no data transformed. Existing event deduplication, public review routes, codes, templates and Firebase rules remain unchanged.
- Template usage remains explicitly unsupported because events have no template IDs; no fake usage numbers or historical cohort/submission conversion is inferred.
- REPORTING_GUIDE.md is the detailed operator/developer guide. .env needs no new service variables. Tests include pure/date calculations, isolated actual SQL aggregation, independent Excel reading, export authorization, responsive component browser interaction and rendered A4 PDF QA. Live Firebase/Neon and native-device/Excel/printer checks remain manual.

## v0.4.1 - 13 November 2026 startup repair

The reported API/JSON failures were caused by missing generated Prisma Client after installation, not a failed migration. scripts/run-next.mjs explicitly generates the pinned client before dev/build and validates it for start; this does not depend on install hooks. lib/api-response.ts is shared by admin/public/upload/export response handling to avoid raw empty/HTML JSON parser errors. Existing schema, migrations, auth, event writer, suggestion engine and clipboard/Google logic are unchanged. See STARTUP_FIX.md and verification/startup-fix/ for restart instructions and clean-install proof.

## v0.5.0 — Business Owner and branded customer experience (2026-11-16)

- Reuses Firebase Email/Password. Existing `requireOwner` retains its historical name but still means allowlisted **Super Admin**, never ordinary Business Owner.
- Business Owner membership is stored in BusinessOwner keyed by Firebase UID + business ID; every protected owner route verifies revocation/email verification and membership. Owner analytics/report queries scope events, inventory, entity options, names and exports to one assigned business.
- New `/owner` workspace has overview, analytics, stand previews/QR downloads, CSV/XLSX/A4-print reports, staff and branding. Super Admin `/admin/owners` manages assignments and generates private setup links on demand; no automated mail is sent by server code.
- Business identity, Google URL and stand activation remain Super Admin-owned. Owner branding fields are logo, brand colour and welcome message only.
- Staff configuration is separate in BusinessExperience. StaffMember supports active/inactive display names and optional roles. Category defaults/custom question, skip selection and feature toggle are supported. Public suggestions validate staff against active stand business; all drafts use neutral attribution and remain editable for every sentiment.
- StaffMention stores one deduplicated successful generation attribution per request, not per draft or Google review. UTC date filters and shared retention apply. Review text/customer identity are not persisted.
- Public review UI is scoped light theme with prominent business branding, contrast-aware brand buttons, optional cover, category wording, clearly labelled sections and existing same-tab copy/Google/manual fallback.
- Additive migration `20261116090000_business_owner_experience`: four new tables, no existing records rewritten. Public lookup tolerates pending migration; new owner features return clear 503 until tables exist. No migration runs during deployment.
- Tests use isolated PGlite and fixture Firebase verification. There is no test-auth bypass in shipped application code. Live owner password setup/email delivery and physical NFC/QR checks remain separate rollout checks.

### Live v0.5.0 status — 2026-11-16

- Code deployed to the existing Smart Reviews Vercel project and approved additive migration applied successfully.
- Verified existing 1 business, 1 stand, 99 templates and 24 analytics events unchanged; new owner/staff tables empty.
- Live public branding and unauthenticated access boundaries checked. Owner invitation/email delivery and a real owner's first login remain human onboarding checks; no real accounts or staff were created as test fixtures in production.
