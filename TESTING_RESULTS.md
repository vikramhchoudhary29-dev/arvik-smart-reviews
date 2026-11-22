# Verification report - Task 5 / v0.4.0

Verified locally on 12 November 2026 with Windows, Node.js 24.19.0, Prisma 6.19.3 and Next.js 16.4.6. **Not declared production-ready.** No live Neon data or deployment was modified.

| Check                                              | Result                                                       | Current evidence                                            |
| -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| TypeScript                                         | Passed                                                       | verification/task5/typecheck.txt                            |
| Unit/integration tests                             | **28 passed, 0 failed** (including nested subtests)          | verification/task5/tests.txt                                |
| Production build                                   | Passed, including /admin/reports and protected report export | verification/task5/build.txt                                |
| Browser tests                                      | **7 passed, 0 failed**, installed Chrome                     | verification/task5/browser-tests.txt / browser-results.json |
| npm audit                                          | **0 vulnerabilities**                                        | verification/task5/audit.json                               |
| Prisma validate / generate                         | Passed                                                       | verification/task5/prisma.txt                               |
| Formatting                                         | Passed                                                       | verification/task5/format-check.txt                         |
| Live Firebase login / Neon / deployment            | Not run                                                      | Requires configured, approved environment                   |
| Native Excel and physical printer / other browsers | Not run                                                      | Manual checks below                                         |

Root-level verification files are retained evidence from the earlier v0.3.0 delivery. Use verification/task5/ for the latest version.

## Analytics and export calculations

Pure tests cover exact UTC Today/7-day/30-day/month presets, inclusive custom boundaries, malformed/reversed/too-wide ranges, leap dates, Monday week grouping, monthly boundaries, zero-filled dates, zero denominator handling, ratios exceeding 100%, case-insensitive search, numeric sorting and CSV quoting/formula injection protection.

New database integration tests create disposable PGlite/PostgreSQL instances and apply all three migration SQL files. Hand-checked events cover two businesses (one inactive), three stands, historical reassignment, unassigned legacy events and out-of-range midnight boundaries. Assertions verify inventory remains platform-wide while activity follows date/entity scope, exact KPI totals, per-business/per-stand grouping, weekly/monthly agreement, empty periods and zero-denominator N/A. Existing event retry/deduplication tests and legacy business/code preservation tests remain passing.

Protected export route tests verify anonymous rejection, unsupported template report (409), bad formats/dates (400), no-store response headers and filtered exported rows. XLSX bytes are independently opened with **ExcelJS** rather than read by the writer itself; tests assert three sheets, exact text/count cells, native numeric percentage values/formats and absence of formula cells. Formula-like business names remain strings in XLSX and are escaped in CSV. Empty-data workbooks remain readable. There is no renamed-CSV-as-Excel export.

Existing authorization, allowlist/unverified-account rejection, business/stand CRUD, active/inactive handling, template edits/disable preservation, seeding, uploads, QR decoding, rate limits and body/origin tests still pass. Firebase verifier responses are stubbed only inside integration test processes; no application auth bypass was added.

## Browser and visual verification

The original review tests run the actual production-mode Next.js server against an isolated database on localhost:4317. They verify public branding, experience selection, regeneration, edited text, actual browser clipboard contents, successful same-tab Google destination navigation (intercepted), failure fallback, invalid stands and unauthorized APIs. No Google review is posted.

Four additional browser tests render the production reporting components in a loopback-only test harness on 127.0.0.1:4318. The harness uses a separate isolated database with clearly identified synthetic fixtures (24 businesses and 30 days of events), the actual SQL/report aggregation and export writers. It is outside app/ and not part of deployed application routing. It does not verify a live authenticated Firebase browser session; production API authorization is tested separately.

Reporting browser assertions cover ten KPIs, date presets, business and stand filters, interval changes, pending/applied filter messaging, mobile width without page overflow, search/sort, genuine downloaded CSV/XLSX contents, unsupported template UI, empty tables/charts, loading skeleton, error retry and print/export inclusion of all 24 matching rows despite 15-row screen pagination.

The A4 landscape report is generated through Chrome print, reopened with pdf-lib for page size/count checks, rendered with Poppler and visually inspected across **all three pages**. White page margins, repeated table headers, row boundaries, readable columns, generation/filter metadata, definitions and page numbering are verified. Desktop/mobile dashboard and dedicated report screenshots were also inspected. A dark-mode print-margin defect found during QA was fixed. Final PDF/example screenshots contain isolated test data only.

Latest visual evidence under verification/task5/:

- task5-dashboard-desktop.png and task5-dashboard-mobile.png
- task5-reports-desktop.png and task5-empty-report.png
- task5-a4-report.pdf and task5-a4-page-1.png through task5-a4-page-3.png (synthetic fixture evidence, not a client report)

## Migration and security boundary

New migration: 20261112170000_analytics_time_index, adding only AnalyticsEvent(createdAt,type). Existing business/time, stand/time and deduplication indexes remain. No events, templates, IDs, permanent stand codes, stored review URLs or confirmation timestamps are changed. Both previous migration files are preserved. No live migration command was run.

All reporting endpoints use the existing Firebase verified-owner allowlist/revocation wrapper and admin rate limit. No public analytics endpoint or external analytics service is added. Reports explicitly distinguish outbound clicks from published reviews, event ratios from unique-user conversion, current inventory from historical activity, and unrecorded template usage from zero usage. Legacy NULL dedup keys are counted as recorded; no unjustified historical deduplication is applied.

fflate is the sole new production dependency; esbuild, ExcelJS and pdf-lib are development-only verification tools. Current audit is zero findings. Existing transitive security overrides are retained; no forced major stack upgrade was performed.

## Remaining manual checks

1. Real allowlisted/unauthorized Firebase users and live token revocation with the intended service account.
2. Isolated Neon-branch index migration and query plans at the expected table size before approving production migration. Check index build locking/storage and backups.
3. Real business/stand data and event totals after deployment approval; installed Excel opening and browser print preferences; Safari/Firefox/native printer layouts. Chrome's browser Print / Save PDF dialog is the implemented PDF flow.
4. True physical NFC/QR scanning and phone-specific clipboard/Google behaviour remain deployment smoke tests; the existing workflow code is unchanged by Task 5.
5. Confirm the chosen UTC calendar date semantics, retention/backup operations and operator access policy. Current inventory does not reconstruct historical statuses. Template usage, unique visitors and published reviews remain unrecorded.

See REPORTING_GUIDE.md for complete semantics and exact VS Code commands, MIGRATIONS.md for approved deployment instructions and KNOWN_ISSUES.md for scale/browser boundaries.

## Latest repair verification - v0.4.1 / 13 November 2026

The current repair supersedes the earlier test totals above: **31 unit/integration tests and nine Chrome browser tests pass**. Added tests cover empty/HTML/malformed API responses, correct JSON validation messages, public lookup/generation failure rendering and preservation of edited review text. TypeScript and the production build pass with the new explicit generation launcher.

verification/startup-fix/ contains current logs. clean-install.txt records an actual fresh npm ci --ignore-scripts reproduction: generated client absent before startup, created automatically by the fixed launcher, dev home HTTP 200, and handled JSON for an unreachable isolated localhost database. No Neon connection or real environment file was used. This tests the install/start path that was not covered by the previous generated-client-only build checks.

Prisma Client was also generated in the user's actual Downloads project; constructor-only initialization was checked without a database query. Live Firebase/Neon application calls after the requested server restart are not claimed verified. No schema/migration change or deployment was performed by this repair.

## v0.5.0 verification — 2026-11-16

- `npm test`: **40 passed, 0 failed**, including isolated PostgreSQL migration/API integration checks. Covers anonymous/invalid/unverified tokens; UID assignment rather than email matching; cross-business analytics, options, reports, QR and writes; immediate revocation; admin-only access grants/private setup links; branding field allowlists; staff enable/disable/category question; invalid/cross-business/inactive staff; neutral critical-feedback attribution; successful-generation/event deduplication; missing-migration public fallback; legacy permanent-code preservation; existing uploads/templates/Google workflow.
- `npm run test:e2e` with installed Chrome: **13 passed**. Tests run production Next server + disposable database for the public flow and real SQL/API fixture servers for analytics/owner UI. Owner fixture mocks Firebase provider and routing only; shipped authorization handlers and database queries are unchanged. Google outbound destination is intercepted; no real review posted.
- Final owner mobile navigation polish: reran `npx playwright test owner.spec.ts`: **3 passed**. Verified loaded mobile/desktop overview screenshots, staff/branding save/persistence, private setup-link display/hide, revocation, QR and CSV downloads. No production owner/staff data was created.
- `npm run build`: PASS after final changes, including TypeScript and all pages/API routes.
- `npm run typecheck`: PASS. `npm run format:check`: PASS. `npx prisma validate` with an offline placeholder URL: PASS. `npm audit --omit=dev`: 0 vulnerabilities.
- Customer screenshots inspected: business-first light theme, category text, optional staff selector, editable critical-feedback drafts, contrast-aware buttons and copy/manual fallback. Owner loaded mobile/desktop dashboard screenshots inspected.
- Initial browser failures identified a localhost/127.0.0.1 origin mismatch in the isolated fixture and an ambiguous test label after the accessible page redesign. Corrected fixture origin and section label; all affected flows subsequently passed.
- Physical NFC/QR devices, real Firebase email delivery/password setup and live owner sign-in are not proved by isolated tests. Live database migration is a separate approval-gated operation. No live migration, reset, cleanup, seed/backfill, owner grant or staff addition was performed during these checks.

### v0.5.0 live smoke — 2026-11-16

- Vercel production READY for application commit `0e6a9d9a80754b955a0082afe1c5933a1095b396` at `https://arvik-smart-reviews.vercel.app`.
- Approved migration applied; historical migration checksums verified; every original business/stand/template/event row unchanged (1 / 1 / 99 / 24 respectively). No seed/backfill/cleanup or fake owner/staff data inserted.
- Installed Chrome: Owner and Super Admin login pages return 200/render; anonymous `/owner` redirects to login; owner me/business/analytics/reports/QR and admin owner endpoints reject unauthenticated requests with 401. Existing active stand's public API returns the new payload; actual business-branded light customer UI loads on phone/desktop without overflow or browser exceptions.
- Real logo image response checked (200 WebP) and screenshot capture waits for image decode. Deployment browser event posts intercepted; no analytics counts were fabricated by verification.
- New owner/staff tables empty by design. A real owner must be assigned by Super Admin, receive/setup their password, verify email and enable real staff selection. End-to-end production inbox delivery and an actual business-owner sign-in are not claimed verified.

## v0.6.0 verification — 2026-11-17

- `npm test`: 45 passed, 0 failed. New cases cover existing settings DTO/resave off/blank/custom; soft-deleted staff hidden/unselectable and mentions preserved; tenant boundaries; admin-only subscription/payment writes; inclusive annual/leap dates; overlap rejection; integer INR paise; partial/paid/due calculations; overpayment and fee-below-paid rejection; void history; renewal history; no leakage of internal notes/payment references; expired subscription keeps an active stand publicly available.
- Chrome browser suite: 14 passed. Existing analytics/report/clipboard/Google journey tests still pass. Owner regressions save settings repeatedly after a persisted row, delete staff, and preserve branding. Subscription UI creates an expired yearly term, records a partial payment, displays owner expiry warning, keeps the public API available, renews the term and validates the WhatsApp href without opening/sending it.
- Production build and TypeScript pass. Isolated Firebase provider mocks remain test-fixture-only; no authentication bypass added to shipped routes. No production plan, payment, staff deletion or message was created to test these features.

### v0.6.0 production migration evidence

User-approved additive migration applied to existing production target after old migration checksums/pending set were verified. Before/after compared every original field in business, stand, template, event, owner, experience, staff and mention rows; all preserved. New subscription/payment tables empty and added fields at defaults. No production payment/plan/staff deletion or WhatsApp delivery test was performed. Live UI authenticated mutations remain verified through isolated browser/API tests rather than altering client records to create proof.

## v0.7.0 outlet verification — 2026-11-22

- npm test: 46 passed, 0 failed on final code. Disposable PGlite migrations and actual route handlers; Firebase token verifier mocked only inside isolated tests.
- npm run test:e2e with installed Chrome: 16 passed, 0 failed on final run. Public journey runs the production Next build; owner/admin component fixture uses real handlers and disposable SQL with mocked Firebase client/router. Google outbound requests intercepted; no real reviews submitted.
- npm run build, npm run typecheck, npm run format:check: passed.
- New coverage: tenant/outlet/staff boundaries, active outlet visibility, preserved Google destination and stand codes, category options, staff-scoped generated drafts, duplicate generation/click deduplication, outlet activity grouping, owner outlet save/default assignment persistence and Super Admin management, mobile overflow and existing billing/reporting flows.
- Reviewed mobile customer and mobile/desktop management screenshots. The initial new owner browser selector timed out; selecting the Category combobox by accessible role fixed the test, and the entire 16-test suite passed afterward.
- Live database and Vercel were not modified for v0.7.0. Live authenticated onboarding and real NFC hardware checks remain for post-approval verification.

### v0.7.0 live completion (approved 2026-11-22)

Migration 20261122090000_business_outlets is applied. Fresh-connection verification against the recovered encrypted backup passed: Business 1, Stand 1, ReviewPhrase 99, AnalyticsEvent 62, BusinessOwner 1, BusinessExperience 1, StaffMember 1 and StaffMention 4 preserved. Existing billing/loyalty/customer tables were also checked (empty at snapshot). Stand lastActivity/updatedAt are excluded from immutable-field fingerprints because customer traffic can legitimately update them. No outlets or assignments were fabricated or seeded; historical outlet IDs remain null.

Live smoke checks passed: both login pages, anonymous API rejection including admin/owner outlet APIs, owner login redirect, existing public stand with new outlet payload, mobile/desktop branding, no browser exceptions or mobile overflow. Smoke event POSTs were intercepted to avoid fake production analytics. Authenticated mutations were verified in isolated tests, not by impersonating live users. Actual account onboarding and physical NFC hardware remain customer acceptance checks. Normal build restored; future migrations still require separate approval.
