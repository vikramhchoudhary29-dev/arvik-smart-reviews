# Startup repair - v0.4.1 / 13 November 2026

## Confirmed cause

The supplied terminal output shows successful migration deployment and an up-to-date database, followed by an import-time error: @prisma/client did not initialize yet. npm ci left no generated Prisma Client. Prisma migrate deploy does not generate that client. The API modules therefore failed before their normal JSON error handlers could run, and the browser displayed secondary JSON parsing errors for HTML/empty HTTP 500 responses.

No database reset, schema change, migration rerun or Prisma major upgrade is needed for this error.

## Repair already completed in your local Downloads project

Prisma Client 6.19.3 was generated successfully in:

C:/Users/vikra/Downloads/arvik-smart-reviews-task5-complete/arvik-smart-reviews

A constructor-only check confirmed that the generated Prisma Client can initialize. That check executed no database query. Seven local startup/client files were updated after verifying that they matched the original Task 5 ZIP; original copies are retained in the workspace backup. .env and .env.local contents were not displayed, copied, changed or bundled. The Prisma CLI loaded the existing .env locally for generation, without connecting to the database. No database migration, query, record change or deployment was performed by this repair.

In your existing VS Code terminal, stop the running development server with **Ctrl+C**, then run:

```powershell
npm run dev
```

Refresh the dashboard and public stand page after the terminal reports Ready. The server needs a restart to reload the generated client and the corrected startup entry point. You do not need npm ci or another migration for this restart.

If using an older unpatched copy, the manual recovery is:

```powershell
npx prisma generate
npm run dev
```

## Permanent code changes

- npm run dev and npm run build now use scripts/run-next.mjs. It explicitly runs the locally installed, pinned Prisma generate command before Next.js. This is part of the main command, not a dependency postinstall hook, so skipping install lifecycle scripts cannot skip generation at startup/build.
- npm start checks client initialization without executing a query and generates it when missing, using the installed Prisma CLI. A normal production build already contains the generated client. Keep using the documented build/install workflow.
- lib/api-response.ts safely handles non-JSON, empty and malformed responses. Admin requests, image upload responses, export errors, public lookup and public suggestion generation use it. Known JSON validation errors remain visible; raw HTML, parser exceptions and server HTML content are not shown to customers.
- A failed suggestion request preserves the customer's editable text. Clipboard and Google redirect logic is unchanged.
- Prisma remains 6.19.3, and all schemas, migrations, authorization rules, event writing and stored data are unchanged. No new dependency or service setting is required.

## Verification

- 31 unit/integration tests passed, including empty/HTML HTTP failures and valid JSON error preservation.
- 9 Chrome browser tests passed, including public-page failures, editable text preservation, reporting and the existing copy/Google flow. Google navigation remains intercepted in tests.
- TypeScript and the production build passed. The build log shows client generation executing before Next.js compilation.
- A separate clean source directory, containing no real environment files, was installed with npm ci --ignore-scripts. Client construction failed before startup (reproducing the installation condition). The fixed dev entry point generated it automatically, served HTTP 200, and returned a handled JSON error for a deliberately unreachable disposable localhost database. That test never connected to Neon.
- The user project's generated client was checked without queries. The live authenticated dashboard/Neon customer flow was not queried by the repair tools; verify it after restarting your server.

Current evidence is under verification/startup-fix/. Earlier task verification remains under verification/task5/. The complete corrected ZIP includes all existing modules and Task 5 features, not only this repair.
