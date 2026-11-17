# Remaining issues and verification boundaries

This release is locally verified, not declared production-ready.

1. Real Firebase account sign-in, service-account token verification against Firebase, email delivery, Neon connectivity/pooling and Vercel/custom-domain behavior require the owner's configured credentials and approved environment. Integration tests stub only the Firebase verifier response; they do not prove live authentication.
2. Real Google listing identity and current destination behavior must be tested by the administrator. Only supported g.page review links and search.google.com/local/writereview URLs are accepted; ordinary Maps listings and other shortened links are deliberately not treated as review forms. Browser tests intercept navigation and never contact/post on Google.
3. Device-level Safari/iPhone/Android clipboard/navigation, installed Google Maps behavior, printed QR legibility and NTAG213 writing/reading need real-device smoke tests. A browser cannot reliably detect every silent navigation block; the visible fallback link remains available after a successful copy.
4. Existing businesses require Google-link re-confirmation after migration; public pages stay unavailable until confirmed. Existing custom phrases need a human sentiment/content review. No bulk confirmation or live data backfill has been run.
5. The 99 starter phrases are intentionally conservative and experience-based. With little input, medium/detailed drafts cannot add facts; they may differ mainly by framing. Regeneration cycles through a finite phrase library. Administrators can extend the active library. English is the interface/library language; free customer edits are not translated or language-policed.
6. Admin lists currently fetch records then search/filter/paginate in the client. This is suitable for a modest central operator dataset; large installations should add cursor pagination and indexed server filtering. Analytics aggregation is server-side and indexed. Chart grouping is UTC and counts events, not unique people or confirmed submissions.
7. Event IDs deduplicate retries, not unique humans. A motivated actor can invent IDs; rate limiting reduces but cannot eliminate abuse. Proxy-supplied IP headers must be trustworthy on the deployment platform. Use an appropriate edge protection policy for hostile traffic; no load/security penetration test has been performed.
8. Analytics retention requires running/scheduling npm run cleanup in an approved environment. No job has been scheduled. Unreferenced media and audit retention need an operator policy. Uploaded branding is public and immutable-cached; use only public brand assets. Database media avoids another service but needs storage/cost monitoring at scale.
9. Business, stand, template and settings changes have transactional action/target/time/verified-actor-email audit entries. Audit records are currently inspected through database administration rather than an audit-log dashboard. Set an operator retention/access policy for administrator email addresses.
10. Loyalty models/data remain extensible and untouched. OTP, rewards and loyalty management are not new features in this release, and rewards must never depend on Google reviews. Business-owner self-service is intentionally outside the initial scope.
11. No separate ESLint setup existed; configured checks are TypeScript, Prettier, unit/integration tests, Playwright and npm audit. Audit zero is a snapshot, not a guarantee. Transitive overrides must be reassessed on dependency updates; unused Firebase Firestore/Storage APIs were not exercised.
12. Privacy notice, backup/access/retention operations and applicable DPDP obligations need operator review before launch. No claim of legal compliance or production readiness is made.

## Task 5 reporting boundaries

- Template IDs and sessions were never recorded. Template Usage is unavailable, and funnel/CTR figures are event-count ratios rather than verified-person conversion or published-review counts. Legacy NULL dedup keys cannot be retroactively deduplicated without evidence.
- All presets and report dates use UTC calendar days. Current inventory is explicitly platform-wide and unaffected by activity entity/date filters; historical statuses are not available. Stand labels show current assignment while activity uses original event-time business IDs.
- Exports recompute a fresh snapshot using the applied date/entity filters, search and sort. Incoming events can change values between screen load and export generation. Summary/charts follow entity/date filters, not table search; definitions state this.
- PDF export uses the browser Print / Save PDF dialog. Chrome A4 output is verified; native printer, Excel desktop and other browser print behaviour remain manual checks. The loopback analytics browser harness uses isolated synthetic fixtures, not a live Firebase session or live business data.
- New date/type index migration is supplied but unapplied to live Neon. Check the approved migration window, real query plans and load at intended scale. Report aggregation is server-side; selectors and aggregated report rows still load the full central dataset before client pagination, so very large inventories may need server pagination/streamed exports.
- Task 5 introduces no ImageKit setting; the separate upload/branding/Maps tasks in the reference attachment were outside this request. Existing environment secrets and media behaviour are preserved.

## v0.4.1 startup status

The reported missing-generated-client/JSON-parser failures are corrected. Existing running dev processes must be restarted (Ctrl+C, npm run dev) to pick up the generated client and startup entry point. Dev/build now generate explicitly even if install hooks were skipped. No migration rerun is required. Underlying server failures still need their terminal log investigated; safe response handling reports them without presenting raw HTML or JSON parser exceptions. Actual Firebase/Neon end-to-end application verification remains a user-environment check after restart.

## v0.5.0 boundaries

- Real Firebase owner invitation/password reset/verification email delivery requires a real owner account and inbox. Provider responses are mocked only in isolated tests; live account onboarding must be smoke-tested by the Super Admin/owner.
- Setup links are generated on demand for manual private delivery; the app does not send invitation emails automatically. No new transactional email service was introduced.
- Staff-generation counts do not prove published reviews or staff service quality. Renamed staff display under their current display name; historical counts keep their staff ID. Deactivation preserves history.
- New features require the additive migration. Existing public pages have a tested schema-pending fallback; this is not a substitute for activating the new tables.
- Existing physical NFC writing/printed QR and real-device Google/Safari behavior still require physical checks. No guaranteed star ratings, review gating or automated review posting was added.

## v0.6.0 boundaries

- Yearly subscription and payment tracking is manual; it does not collect payments, auto-debit, produce tax invoices, automatically remind customers or verify payment references. Invalid payment entries can be voided with an audit trail; no refund is initiated.
- WhatsApp reminder links open a prepared chat; delivery/read/sent status is not tracked or claimed. Use the dedicated renewal number and manually review/send the message.
- Expiry never disables NFC/QR public pages under the selected warning-only policy. New tables start empty; Super Admin must enter the actual agreed annual fee and real payment records.
- Removed staff are hidden/unselectable but retained internally to preserve historical mentions; Delete is not permanent erasure. Subscription dates are annual immutable term boundaries; edit fee/notes or append a renewal term.
