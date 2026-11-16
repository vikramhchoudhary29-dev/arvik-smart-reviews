# Changed files - v0.4.1 startup repair

Compared with the complete Task 5 v0.4.0 ZIP. All earlier modules are included; no source files were removed.

## Added

- `lib/api-response.ts`
- `scripts/run-next.mjs`
- `STARTUP_FIX.md`
- `tests/api-response.test.ts`

## Changed

- `app/r/[code]/page.tsx`
- `components/admin.tsx`
- `components/reports.tsx`
- `DEVELOPMENT_LOG.md`
- `KNOWN_ISSUES.md`
- `package-lock.json`
- `package.json`
- `PROJECT_CONTEXT.md`
- `README.md`
- `TESTING_RESULTS.md`
- `tests/browser/review.spec.ts`
- `tests/fixtures/analytics-entry.tsx`

No schema, migration, authentication, event writer, template engine or copy/Google navigation logic changes. Current verification is under verification/startup-fix/. Prior Task 5 evidence is retained.

## v0.5.0 additions and updates

- Added `app/owner`, `app/api/owner/*`, `app/admin/owners`, `app/api/admin/owners/*`, owner dashboard/login/access-manager components, `lib/business-access.ts`, `lib/experience.ts`, shared upload/export handlers, four-table additive migration and owner integration/browser fixtures.
- Updated Prisma schema, customer review page/public APIs, analytics server/model/workspace/export scope, Super Admin navigation/login label, home login links, event attribution, error handling, retention maintenance, version metadata and documentation.
- Existing template engine, stable stand codes, Google destination validation, Firebase Super Admin allowlist, QR generation and recorded historical analytics remain in place. No new runtime dependency or analytics service introduced.
