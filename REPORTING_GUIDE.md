# Task 5 - Dashboard and reports (v0.4.0)

## Scope and inspection

This extends the complete v0.3.0 project already available in this chat. The current request is Task 5; ImageKit integration, image-upload replacement, Google Maps validation changes and public-page redesign from the pasted Tasks 1-4 were not added to this scope. Existing business, stand, template, branding, Firebase and Google review workflows are preserved. No new loyalty, OTP, customer account or third-party analytics features are introduced.

Before editing, inspected the project structure, package lock, Prisma schema/migrations, Firebase authorization and route wrapper, public event/generation routes, media pipeline, public page, admin CRUD, analytics UI/API, tests and documentation. Existing AnalyticsEvent stores businessId, optional standId, type, createdAt and a nullable unique dedupKey. It records no template IDs, sessions, unique visitors or completed reviews.

The old dashboard combined multiple inventory counts in large cards, combined all event types in one activity chart, had manual dates without presets, and had no dedicated reporting/export module. Its rolling default window was not an explicit inclusive calendar-date preset. New code uses one validated date/entity filter for every activity query and a consistent database snapshot.

## Navigation

- /admin: premium dashboard with ten KPI cards, visits/clicks trends, independent-stage funnel, top businesses, top stands, business visit distribution and recent timeline.
- /admin/analytics: existing route preserved with the improved analytics/reporting surface.
- /admin/reports: dedicated report library with a concise period summary and Overview, Business Performance, Stand Performance, Review Funnel, Date-wise Activity and Template Usage tabs.
- Existing Dashboard, Businesses, NFC Stands, Review Templates, Analytics and Settings navigation remains; Reports is added.

## KPI definitions

| KPI                          | Meaning and scope                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Total Businesses             | All current business records, platform-wide; not date/entity filtered.                                                                                                                                                   |
| Active Businesses            | Current ACTIVE business records; not status as of the historical report date.                                                                                                                                            |
| Inactive Businesses          | Current INACTIVE business records, including records with historical activity.                                                                                                                                           |
| Total NFC/QR Stands          | All current stand records, across NFC+QR, NFC-only and QR-only types.                                                                                                                                                    |
| Active Stands                | Currently enabled stands. Public access also depends on the business being active and its destination confirmed.                                                                                                         |
| Total Review Page Visits     | Recorded PAGE_VIEW events in the applied date/entity scope; not unique people or NFC-only scans.                                                                                                                         |
| Review Suggestions Generated | SUGGESTION_GENERATE events; each produces three drafts. Regenerations are separately counted and visible in reports/tooltips.                                                                                            |
| Review Copies                | Recorded successful clipboard-copy events; no evidence of paste or submission.                                                                                                                                           |
| Google Review Page Clicks    | GOOGLE_LINK_CLICK events, including copy-and-continue attempts; not confirmed published Google reviews.                                                                                                                  |
| Google Click-Through Rate    | Outbound click events / visit events x 100. Event ratio, not unique-person conversion. Zero visits is N/A (shown as an em dash on screen). Repeated clicks can legitimately yield more than 100%; values are not capped. |

Inventory is deliberately labelled as platform-wide current records and does not change with date/business/stand filters. Activity and all report summary totals use the applied dates/business/stand consistently. A table search/sort affects report rows, not summary cards/charts; that distinction is stated in definitions and exports.

## Filters and date semantics

Presets: Today, Last 7 Days, Last 30 Days, This Month and Custom Date Range. All are **UTC calendar dates**, independent of the browser's local timezone. Last 7 includes today and six previous dates; Last 30 includes today and 29 previous dates. This Month starts on UTC day 1. Custom ranges include both selected calendar dates, use an exclusive next-midnight SQL upper bound and allow at most 366 days. Missing/invalid/reversed dates are rejected.

Daily, Monday-based weekly and monthly buckets include missing dates as zero. Partial first/last weeks and months include only the selected dates. Business and stand filters intersect using event-time IDs. All stand choices remain available so a reassigned stand's historical business activity can still be queried. Stand report labels identify the **current** business assignment; events retain their original stored businessId. Legacy events with no stand appear in an explicit unassigned-history row rather than disappearing from totals.

Filters are applied with the Apply button. Draft changes show a pending message and do not relabel old data. A request sequence guard prevents a slower earlier response from overwriting newer results. Loading skeletons, retryable errors and empty states are implemented. The generated timestamp and applied filter summary remain visible. Charts show independent event counts, not a cohort of verified people moving through a conversion funnel.

## Reports, exports and printing

Search every visible table value, sort by a selected column in either direction and paginate screen rows (15/page). All matching rows, not only the current page, are exported/printed.

- CSV: UTF-8 with BOM, proper quotes/newlines, report generation time, dates, entity filters, search, sort and definitions. Formula-like string values receive an apostrophe prefix to protect spreadsheet consumers. Numeric counts remain numeric-looking values.
- Excel: a genuine .xlsx OOXML ZIP, not renamed CSV/HTML. Three sheets: Report, Summary and Definitions. Numeric counts and rates use numeric cells; rates have Excel percentage formatting. String cells are never formulas. Styled headings, widths, wrapped text, frozen headers and autofilters are included. The small fflate runtime dependency assembles the workbook; ExcelJS is a development-only independent test reader.
- PDF: select Print / Save PDF, then choose your browser's Save as PDF destination. A named A4 landscape print layout contains brand/report title, generation time, applied filters, summary totals, every searched/sorted row, repeated table headings, definitions and page numbering. Current Chrome output was rendered with Poppler and visually inspected. There is no server PDF service or paid renderer. Save-as-PDF is an explicit browser dialog, not a direct PDF API download. Other browsers/printers need manual confirmation; enable background graphics if your print preferences suppress fills.

CSV/XLSX exports are regenerated from a fresh consistent database snapshot with the last applied filters, search and sort. New incoming events may make a later export differ from an earlier on-screen snapshot; each export includes its own generation timestamp. Summaries in the workbook retain date/entity scope even when a table search narrows the Report sheet.

Template usage is **unavailable** because no template/phrase IDs were recorded. The UI explains this and disables usage exports; /api/admin/reports?report=templates returns 409. Initial generation totals must not be presented as template usage. No speculative historical backfill was attempted.

## Backend and security

/api/admin/analytics is still Firebase-owner protected and retains its legacy top-level totals, daily, businessPerformance, standPerformance and status-group fields for compatibility. It additionally supplies typed, minimally selected reporting data. /api/admin/reports is protected by the same verified-email allowlist, token revocation checks, shared admin rate limit and safe error wrapper. Both responses use private, no-store cache policy. No public analytics endpoint was added.

Activity queries aggregate in PostgreSQL instead of loading all raw events. A repeatable-read transaction keeps each response's totals, series, entity groups and inventory consistent. Entity lookups are mapped in linear time after aggregation. Only 20 recent events are loaded; selectors contain names/IDs rather than contact details. Existing business/time and stand/time indexes remain. A new additive (createdAt,type) index supports unscoped date reports. See MIGRATIONS.md for its unapplied deployment instructions.

The existing dedupKey uniqueness and event writer are unchanged. New duplicate event retries remain one recorded event. Historical rows with NULL dedupKey are counted as recorded: they cannot safely be reclassified as duplicate or unique people. No records, permanent codes, phrase data or review destinations are rewritten by Task 5.

## Setup and upgrade in VS Code

Use the complete ZIP; open its arvik-smart-reviews folder in VS Code and open a PowerShell terminal. Node.js 24 and the existing .env configuration remain required. No additional credentials or external analytics service are needed. Keep existing populated environment files private; do not overwrite them with the empty example.

```powershell
npm install
npx prisma generate
npm run typecheck
npm test
npm run build
npm run dev
```

Before applying the new index to an **approved development database**:

```powershell
npx prisma migrate status
npx prisma migrate deploy
```

Do not run those migration commands against live Neon without approval. For an existing v0.3.0 database, the only new migration is 20261112170000_analytics_time_index. No business/stand/template backfill or link re-confirmation is required by Task 5. Earlier Phase 2 upgrades still need their separately documented initial migrations/backfill. Production index creation should be scheduled and checked for lock/storage impact on the actual table size. No database migration or deployment was run by this task.

## Verification and remaining checks

TESTING_RESULTS.md and verification/task5/ contain the current evidence. New reporting integration tests use an isolated PostgreSQL/PGlite database and hand-checked event fixtures. Component browser tests use a separate loopback-only test harness with synthetic businesses/events; this harness is outside app/ and is not a deployed authentication bypass. The production endpoint authorization is separately exercised in API tests. No fixture rows are inserted into application/live data by the production build or seed command.

Still verify real Firebase sign-in, the intended Neon endpoint/query plans at actual scale, the approved index migration, installed Excel/browser print preferences and business-specific real data in your environment. No live credentials were supplied. Template-level usage and verified-person/submission conversion cannot be reconstructed from the current schema. Production readiness is not claimed.
