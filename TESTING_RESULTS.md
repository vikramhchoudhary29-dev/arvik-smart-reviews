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
