# Arvik Smart Reviews

**v0.4.1 startup repair:** See [STARTUP_FIX.md](STARTUP_FIX.md). Dev/build explicitly generate Prisma Client even if install lifecycle scripts were skipped; API response errors are handled safely. Existing configured installations need no new migration.

**v0.4.0 / Task 5:** See [REPORTING_GUIDE.md](REPORTING_GUIDE.md) for the redesigned dashboard, dedicated Reports module, UTC filter semantics, CSV/Excel exports, A4 Print / Save PDF and the index-only upgrade. No additional service credentials are needed.

Arvik Digital's centrally managed, one-time-payment NFC/QR review assistance platform. This extends the supplied Phase 2 project using Next.js 16, React 19, Tailwind 4, Prisma **6.19.3**, PostgreSQL/Neon and Firebase Authentication. No paid AI calls. No subscription or payment gateway is required.

**Release status: implemented and locally verified; not certified production-ready.** Live Firebase sign-in, Neon, Vercel, real Google listings and physical phones/tags must still be verified with the intended configuration. See TESTING_RESULTS.md and KNOWN_ISSUES.md.

## Exact local setup (PowerShell, Node.js 24 LTS)

Extract the entire project ZIP and open PowerShell in its arvik-smart-reviews directory. Use a fresh development database or an isolated Neon development branch. Commands below do not deploy anything.

```powershell
node --version
npm install
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
notepad .env
```

Fill every Firebase setting, DATABASE_URL, ADMIN_EMAILS, and RATE_LIMIT_SECRET (use the generated random value). Keep NEXT_PUBLIC_APP_URL=http://localhost:3000 locally. The .env file is loaded by Next.js, Prisma CLI, and the documented seed/cleanup scripts. Do not put service-account credentials in NEXT_PUBLIC_* variables.

Create or select a Firebase project, enable Email/Password authentication, create the administrator account, verify its email, and add that exact email to ADMIN_EMAILS. Register the web application; use its web config for NEXT_PUBLIC_FIREBASE_* settings. Set the server project's service-account project ID, client email and private key separately. Add localhost and the eventual custom domain to Firebase Authentication's authorized domains. An empty allowlist denies all administrator access.

After reviewing and approving changes to the **development** database:

```powershell
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm run seed
npm run typecheck
npm test
npm run build
npm run dev
```

Open http://localhost:3000/admin/login. Do not run migrate reset or db push against existing data. If port 3000 is occupied, use npm run dev -- --port 3001 and update NEXT_PUBLIC_APP_URL accordingly.

## Verify browser flows locally

Unit/integration tests create their own disposable PGlite PostgreSQL instance in memory; they override DATABASE_URL inside the test process. No external database is used. Firebase verifier responses are stubbed only in the test process; application authorization logic is exercised unchanged. There is no test authentication bypass in the application.

```powershell
npx playwright install chromium
npm run build
npm run test:e2e
npm run format:check
npm audit
```

The browser suite starts a disposable local database and production-mode server on **4317**, plus isolated analytics and owner component/API/SQL fixtures on **4318** and **4319**. Keep all three ports free. On this Windows host the downloaded Chromium executable could not spawn, so the verified run used installed Chrome:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

These tests intercept the Google destination instead of contacting Google or submitting reviews. Browser screenshots and JSON results are written under test-results. No ESLint configuration existed in the original; TypeScript, automated tests, and Prettier are the configured checks.

## Administrator workflow

- Dashboard/Analytics: real visits, generation/regeneration, copies, outbound clicks, business/stand status counts, recent activity, daily/weekly/monthly charts, business and stand reports; UTC date filtering up to 366 days. These events do not prove published reviews, unique visitors, or NFC versus QR usage.
- Businesses: create/view/edit, all contact/address/branding fields, category and business color, drag/drop logo and cover images, search/status filter/pagination, assigned stands and analytics. New businesses are inactive. Delete is permitted only when there are no stands, customers, events or stamp transactions; otherwise deactivate to preserve history.
- Google destination: copy the review link from Google Business Profile's **Get more reviews** action. Open the test link and confirm the intended business. Then mark the confirmation checkbox and activate. Format validation is enforced on the server; the administrator confirms real listing identity. Changing a destination clears its confirmation; an active business cannot save an unconfirmed replacement. Set inactive first if replacing a link before testing it.
- Supported review destinations: HTTPS g.page/r/CODE/review, legacy g.page/SHORT-NAME/review, and search.google.com/local/writereview?placeid=YOUR_REAL_PLACE_ID. Generic Google pages, ordinary Maps listings and arbitrary shortened URLs are rejected. Store a Maps listing separately under Google Maps URL. Do not fabricate a Place ID. Other formats need explicit validation support before use.
- Stands: random 128-bit permanent codes, label/type/location, reassignment, active state, last activity, copy public URL, PNG/SVG QR exports, print layout and stand analytics. Reassignment never changes the stand code. Historical events retain their original business assignment.
- Templates: category, aspect (* means any selected aspect), sentiment, editable text with {aspect}, enable/disable, preview, search/filter/pagination and delete. The engine uses active database phrases. The seed adds 99 starter phrases across 11 categories and three sentiments; repeating it does not overwrite edits or re-enable disabled phrases.
- Settings: support contact and analytics retention, plus public origin configuration visibility. Change secrets, allowlist and public origin through environment configuration.

Google's instructions for obtaining a review link: https://support.google.com/business/answer/16816815?hl=en. This app validates permitted URL shapes; it does not establish Google ownership or verify a live listing automatically.

## Customer workflow

/r/PERMANENT_CODE loads only an active, confirmed business and active stand. The customer selects category aspects, chooses positive/neutral/critical experience, optionally adds their own words, generates three drafts, selects/edits or writes their own review, then clicks **Copy & Continue to Google**. A successful clipboard write records best-effort anonymous copy/outbound interactions and immediately navigates in the same tab. Tracking failures do not block navigation. A denied clipboard shows manual selection and a separate Google link without falsely claiming success. The fallback stays available if navigation does not complete.

Google receives no automatic review prefill. The customer pastes, chooses a rating and submits voluntarily. No review incentives, gating or automated posting. Draft text and personal notes are not stored in analytics. Public pages require no account.

## Database migration and existing-data upgrade

See MIGRATIONS.md **before running against an existing database**. The original 20261111063631_init migration is preserved. The additive 20261112090000_complete_reviews migration adds branding/contact fields, stand metadata, generation event variants, event deduplication/indexes, phrase sentiment, settings, media, audit and rate-limit tables. Loyalty tables and existing IDs/stand codes are preserved. No live migration has been executed for this delivery.

Existing business links have no confirmation timestamp after migration. Their public pages intentionally remain unavailable until an administrator reviews the destination and saves the confirmation. Categorize legacy businesses and review their existing ReviewPhrase records; old phrases default to neutral. Starter phrases are not a legal or content-quality review of existing phrases.

## Image storage and maintenance

Uploads accept PNG/JPEG/WebP up to 1 MB. The server checks signatures and decodes them, limits decoded images to 20 megapixels, rotates/resizes to at most 1600x1200, strips metadata and stores WebP bytes in PostgreSQL. This works on Vercel without an ephemeral filesystem or a new paid storage service. Media URLs are public for page branding and use immutable caching. Replacing an image creates a new URL. Assess database storage/caching costs at scale; do not upload private documents.

Analytics retention is enforced by this command using the saved retentionDays (default 90). It also removes expired minute-rate-limit rows:

```powershell
npm run cleanup
```

Schedule the command daily in an approved maintenance environment. It deletes expired analytics only; do not point it at a live database until retention/deletion is approved. No scheduler has been provisioned. Orphan image cleanup and audit retention need an operator policy; they are not automatic.

## Deployment preparation (requires your separate approval)

1. Back up the intended Neon database and verify restore capability. Validate the migration on a separate Neon branch. Review MIGRATIONS.md and approve the production change.
2. Commit source/lockfile to your GitHub repository, excluding populated .env files, node_modules, .next and test results. No repository has been published by this task.
3. Configure Vercel for Next.js, Node.js 24, install command npm ci, build command npx prisma generate && npm run build. Use a separate approved migration step; do not run migrations automatically on every build.
4. Set the variables from .env.example in the correct Vercel environment. Set NEXT_PUBLIC_APP_URL to the permanent HTTPS custom-domain origin with no path/trailing slash. Public Firebase variables are build-time values; rebuild after changing them. Use the appropriate Neon application connection URL. For migrations, use the direct Neon endpoint, not a transaction pool.
5. After approval only, run npx prisma migrate deploy against that production endpoint and npm run seed with the intended DATABASE_URL. See the exact migration procedure below. Deploy through the approved Vercel/GitHub workflow; no deployment was performed here.
6. Add the custom domain in Vercel, configure the DNS records it provides, wait for HTTPS, and authorize that hostname in Firebase Authentication. Verify security headers and intended proxy client-IP handling. Public traffic rate limiting assumes your hosting proxy supplies trustworthy x-forwarded-for values.
7. Complete the production smoke tests in TESTING_RESULTS.md. Print/program stands only after the permanent origin and real Google destinations are confirmed.

## NFC writing / QR printing

Use a compatible NFC phone and a trusted NFC writer to store the stand's permanent HTTPS /r/code URL as an NDEF URL record on an NTAG213 sticker. Read it back and test on Android and iPhone. Do not write the direct Google URL. Keep URLs short enough for the tag capacity. Test the QR from both PNG and SVG at the intended print size with the quiet zone intact. The printable layout includes business name, instructions and a high-contrast QR with four-module margin. Confirm multiple phones can scan the actual printed stand. Do not lock a tag until verified. The software generates URLs/QR images; it does not claim to program NFC hardware.

## Security / privacy boundaries

All /api/admin endpoints require a Firebase ID token, server-side revocation check, verified email and the server allowlist. APIs reject unknown fields, invalid URLs, bad request bodies and cross-origin writes. Admin and public rate limits use shared database buckets with keyed hashes of proxy-supplied IP addresses, not raw stored IPs. Event IDs deduplicate retries per stand/type. This reduces accidental duplicates; it cannot prove unique humans or prevent determined analytics manipulation. Business, stand, template and settings mutations write transactional audit entries with the verified administrator email. Review drafts/notes are not persisted. React text rendering prevents HTML injection; uploads exclude SVG and are re-encoded.

Review privacy notice, hosting region, retention/backup handling and applicable Indian DPDP obligations with your organization before launch. Existing loyalty/customer tables are preserved but no new loyalty collection, OTP or rewards collection is enabled. Business Owner access is described below.

## Project files

PROJECT_CONTEXT.md describes architecture, DEVELOPMENT_LOG.md records changes, CHANGED_FILES.md lists source additions/changes, MIGRATIONS.md covers upgrade safety, TESTING_RESULTS.md records evidence, KNOWN_ISSUES.md names remaining boundaries. verification/ contains final test/build/audit evidence and mobile screenshots. The full ZIP excludes installed dependencies, build caches, real environment files and temporary local databases.

## v0.5.0 — Business Owner, staff mentions and customer branding

- Super Admin: /admin/login → Business Owners → assign an email to an existing business. Firebase accounts are created only through this protected action, when needed; there is no public registration UI or automatic access based on email/domain.
- Generate a password setup link only when needed and share it privately with the intended owner. This action does **not** send email automatically. The link is short-lived, not stored/logged, and resets the account password. Owners verify their email using Firebase's verification email at first sign-in. Existing verified accounts can sign in directly.
- Owner sign-in: /owner/login. Forgotten-password and first-login verification use the existing Firebase Email/Password provider. Configure Firebase authorized domains and email templates for your actual application domain. No new authentication provider or API key is needed.
- Owner workspace: Overview, Analytics, My Stands (preview/QR download), Reports (CSV/XLSX/A4 print), Staff and Branding. Every request requires a verified, non-revoked Firebase ID token **and** an active UID/business assignment. Each business selector and report is scoped server-side; business IDs from a browser never grant access.
- Owners edit logo, brand colour and welcome message only. Business name/category, Google destination and stand activation remain Super Admin-controlled. Logo uploads reuse validated, re-encoded PNG/JPEG/WebP handling and the 1 MB limit.
- Staff: add/edit/activate/deactivate up to 100 records; optional role; enable/disable the public question; custom wording or category default. Use staff-approved display names. Inactive staff are hidden and rejected by generation APIs; historical counts remain.
- Mentions count successful generation requests (including regenerations), deduplicated by the analytics event. They are not three mentions per three drafts, published reviews, unique people, staff ratings or review-copy counts. Staff name/role attribution is neutral and editable; no praise is invented. Selected UTC date filters apply to mention counts.
- Customer page: business-first light theme, optional cover/logo, accessible brand-colour buttons, category wording, optional staff choice, editable drafts, existing clipboard/manual fallback and Google workflow. All sentiments can continue to Google. No auto-posting or review gating.
- Apply the additive migration in MIGRATIONS.md **only after live-database approval**. No seed is required for this upgrade. Existing stand codes/URLs, templates, historical events and Google-link confirmations remain unchanged.
- Without the new tables, existing public review pages continue with staff disabled. New owner/admin-owner features return a clear 503 database-update message. This permits a safe code rollout while migration is pending; it does not mean the new features are activated.

### Exact local setup (PowerShell)

Copy .env.example to .env and fill in the existing database/Firebase settings locally. Do not commit environment files. For a new isolated development database, apply all migrations; for an existing database, review migration status first.

```powershell
npm ci
npx prisma generate
npx prisma migrate status
# Only against your approved development/upgrade database:
npx prisma migrate deploy
npm run dev
# Open http://localhost:3000/owner/login or /admin/login
```

Verification (disposable databases; no seed/live credentials required):

```powershell
npm run typecheck
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_CHANNEL
npm run format:check
```
