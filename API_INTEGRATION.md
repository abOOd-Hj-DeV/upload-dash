# API integration and security boundaries

## Contract baseline

Reviewed the supplied endpoint workbook against backend branch [`devin/1791704163-production-blocker-repair`](https://github.com/abOOd-Hj-DeV/final-repo-for-sakina-backend/tree/devin/1791704163-production-blocker-repair), commit `c381db6`. Current Laravel source is authoritative where the workbook is stale. No backend source is changed by this frontend PR.

## Connected surfaces

| Surface           | Live behavior and deliberate limits                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication    | WhatsApp/password, invitation activation, proof-bound six-digit staff challenge where returned, password reset. Therapist/public signup and Google OAuth are unavailable. Therapist login currently does not require backend MFA.                                                        |
| Dashboard/clients | Server stats, real UUID client/session links, paginated clients. No fabricated income, clinical metrics or fake status fallback.                                                                                                                                                         |
| Profile/settings  | Identity and therapist profile, supported professional settings, timezone, availability, whole-day blocked periods, notification preferences, password change and logout. Identity fields that have no write endpoint are read-only.                                                     |
| Sessions/clinical | Server status/timezone, confirm/report/complete/link/cancel/reschedule-decision/recommendation actions where authorized, private notes, supported clinical/module/content reads and writes. Reports are clearly distinguished from private notes because reports can be patient-visible. |
| Homework/content  | Supported text/video/PDF/link creation and assignment. No invented audio/interactive/upload homework or therapist-side patient completion controls. External URLs must be HTTPS without embedded credentials.                                                                            |
| Chat              | UUID counterpart routes, chronological messages, authenticated binary attachments, idempotent sends, read receipts, closed-thread read-only behavior and cancellable HTTP polling. Reverb is not assumed configured.                                                                     |
| Notifications     | Server pagination/unread counts/read operations. Allowlisted labels/routes rather than rendering arbitrary backend notification HTML or raw payload text.                                                                                                                                |
| Wallet            | Server totals and recent requests only. Supported bank transfer/PayPal/Wise/other payout instructions; success means **pending manual review**, never an instant transfer. No invented monthly chart, session ledger or Shamcash/Al-Haram provider integration.                          |
| Help/support      | Backend FAQs/contact routes where supported. No fabricated phone calls/live support connection.                                                                                                                                                                                          |

Client-profile routes validate UUIDs and the active therapist/client relationship before loading current clinical information. Private notes and assigned content load on demand; a mismatched profile identity is not displayed. The frontend blocks current clinical access for former clients, but this does **not** fix the backend relationship finding below. Scheduling, calling, missing contact/subscription fields and unsupported progress calculations remain disabled or explicitly unavailable.

The source/demo Figma views are preserved for development reference, not presented as working server capabilities. Comprehensive live-mode Figma parity remains unverified. The current audit separates natural-size, downscaled, metadata-only and missing references; see README.md. Missing mobile-profile/password references remain unverified.

## Frontend safeguards

- Memory-only access/refresh credentials; bearer header only to the configured API prefix. No credentials in URLs, persistent browser storage, analytics or logs.
- HTTPS required outside loopback development, no fetch redirects, cookies omitted, no-store request caching and no-referrer policy. Encoded traversal and API-origin escapes rejected.
- Valid therapist role/active/phone-verified session required before private navigation. Backend authorization remains authoritative: hiding a button is not an authorization fix.
- Rotating refresh deduplication, serialized refresh/logout, session-generation checks, request cancellation, and generation-keyed page boundaries clear stale sensitive results/drafts even on same-account reauthentication.
- Fixed error messages for HTTP failures and safe field identifiers only; raw Laravel/provider/database error strings never reach the interface. `Retry-After` is respected where relevant. Mutations are not automatically retried after 401.
- Stable idempotency keys for supported operations, synchronous duplicate-submit guards, and unknown-outcome reconciliation. Wallet payout instructions stay in an API-client-scoped WeakMap during in-app navigation until resolved; logout/identity changes discard them. No disk persistence.
- On a hard reload, unresolved browser intent/key is lost intentionally. Check server history and contact finance if uncertain before creating another request. Backend pending-request checks remain the authority; do not interpret local cancellation as server rollback.
- Clinical text is ordinary escaped React text, not injected HTML. Downloads use authenticated blob requests and revoked object URLs; bearer tokens are never forwarded to arbitrary attachment URLs.

Memory-only storage reduces persistent credential exposure but does **not** protect against active same-origin XSS. Deploy with an appropriate CSP, TLS, narrow CORS, controlled asset hosting and dependency monitoring. A reviewed BFF/HttpOnly-cookie design would require a separate backend contract.

## Unresolved backend/release findings

These are verified static code boundaries, not reproduced exploits or claims of compromise. The frontend cannot remediate them.

1. **High: activation lifecycle race.** Invitation activation commits under a lock, then token issuance occurs outside that transaction without a final eligibility/credential-proof check. See `AuthService::activate`, `StaffAccountService::activate`, and auth-route middleware. Backend issuance must be made atomic with lifecycle validation.
2. **High: logout/refresh revocation race.** Logout revokes rows for the current bearer while refresh replaces that pair under a user lock; an overlapping refresh can leave the replacement alive. Frontend serialization only reduces same-tab exposure. Backend session-family revocation/locking is required.
3. **High: clinical relationship privacy.** Historical non-cancelled sessions can authorize access to a former client's current assessment/safety/compliance fields. Review `TherapistClientService` relationship policy and return minimum authorized clinical data.
4. **Assurance decision:** therapist and patient login intentionally remain one-factor. Only staff roles receive the proof-bound second-factor challenge. Frontend cannot mandate therapist MFA without a backend change.
5. **Logging/retention:** invitation-provider exceptions have a raw-message logging path; redaction is not guaranteed. Expired auth challenge/staged data cleanup needs an operational retention schedule. No actual provider secret leakage was reproduced.
6. **Privacy/concurrency:** `/auth/status` exposes pending verification state; reports/recommendations/parallel saves do not all have complete optimistic-concurrency protection, and some responses include more raw clinical fields than the UI needs. Review approval/permission boundaries server-side.
7. **Deployment checks:** no production URL, real therapist test credentials or WhatsApp-provider verification was supplied. The skipped PostgreSQL independent row-lock schedules are release work, not proven safe by SQLite tests. Privacy-policy configuration must also be reviewed before patient onboarding elsewhere in the product.

## Verification scope

- TypeScript, ESLint, production build, dependency audit and synthetic component/API tests run locally. ESLint currently has seven non-blocking development Fast Refresh warnings in the care-support module; no errors.
- The earlier integration revision passed 119 Playwright **demo/reference** tests on pinned Linux Chromium. They are historical application baselines, not a live backend browser test or Figma parity score, and were not silently replaced after visual repairs. The final R9 audit passed 74 responsive cases, captured 44 canonical states and verified the production demo guard; original-reference coverage remains incomplete. The current offline suite passes 287 tests with eight opt-in HTTP tests skipped.
- Backend PHPUnit: **512 passed, 39 skipped, 4,446 assertions**; Pint passed. Skips require disposable PostgreSQL/independent row-lock processes.
- Eight HTTP contract tests passed using the actual frontend `ApiClient` against the inspected Laravel branch, an isolated SQLite database and synthetic therapist/client data: login/identity, dashboard/client/session response shapes, settings write, clinical/private notes, idempotent chat, content/notifications, idempotent manual-review withdrawal and logout. No real clinical data or external WhatsApp delivery was involved.

The HTTP suite is opt-in and mutates synthetic notes/chat/withdrawals. Run it only against a fresh disposable instance using `SAKINA_CONTRACT_API`, `SAKINA_CONTRACT_FIXTURE` (JSON with phone/therapist/patient/upcoming/completed synthetic IDs), and `SAKINA_CONTRACT_PASSWORD` supplied securely in the process environment. Never put that password in `VITE_*`, shell history, tracked files or test reports. It is not a production smoke test.
