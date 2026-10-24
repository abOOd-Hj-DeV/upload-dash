# Sakina — Therapy Dashboard

Responsive React + TypeScript implementation of the **three supplied** Sakina Figma files, with a live Laravel API mode and a separate, development-only design-reference mode. Vite serves the app; fonts, illustrations, patient photos, and icons are local assets.

## Run

Requires Node.js **22.12+** (Node 22 recommended) and npm.

```sh
git clone --branch devin/1792262325-figma-complete-pixel-audit https://github.com/abOOd-Hj-DeV/therapy-dashboard.git
cd therapy-dashboard
npm ci
cp .env.example .env.local
npm run dev
```

Open the address Vite prints. On WSL2, run the same commands from your project directory (for example `/mnt/c/Users/1/Desktop`) and open the printed address in your Windows browser. You can also run this in PowerShell with Node installed.

```sh
npm run build       # production files in dist/
npm run preview     # preview the production build
```

Configure production hosting to rewrite unknown paths to `index.html` so direct links to all the routes below work.

## Live API mode (default)

Start Laravel separately on `http://127.0.0.1:8000`; the Vite development proxy forwards `/api` there. Configure `VITE_API_PROXY_TARGET` for a different local port. `VITE_API_BASE_URL` must end in `/api/v1`: use a same-origin reverse proxy in production, or an explicit HTTPS backend with correctly configured CORS. Only loopback API hosts allow HTTP. `VITE_*` variables are public build configuration, **never secrets**. PowerShell users can use `Copy-Item .env.example .env.local` instead of `cp`.

Login uses international WhatsApp number + password and requires an active, verified therapist account. Therapists activate an invitation through `/activate`, not public signup. Reset uses `/forgot-password` and `/reset-password`. Google sign-in is unavailable. A browser reload deliberately signs out: access/refresh tokens are held in memory, not browser storage. `/clients`, sessions, records, profile, chat, notifications and wallet use server data; a failed request never falls back to fixtures.

See [API integration, security boundaries and release gaps](API_INTEGRATION.md) for exact coverage and unsupported Figma controls. This frontend PR does **not** repair the documented backend security findings or prove production readiness.

For design previews only, set `VITE_DEMO_MODE=true` in `.env.local` and restart Vite. Production builds always disable this bypass. Playwright snapshots explicitly enable the development reference mode; they do not validate live API layouts or 100% Figma parity.

## Design-reference screens (explicit demo mode)

| URL                                   | State                                                           |
| ------------------------------------- | --------------------------------------------------------------- |
| `/` or `/login`                       | Sign in; disabled, filled, password visibility, loading         |
| `/signup`                             | Create account; desktop names side by side, phone names stacked |
| `/verify`                             | Five-digit verification; keyboard and paste support             |
| `/dashboard`                          | Therapist dashboard; four metrics and seven upcoming sessions   |
| `/dashboard?state=collapsed`          | Collapsed desktop sidebar                                       |
| `/dashboard?state=expanded`           | Expanded phone navigation                                       |
| `/dashboard?state=search`             | Open search with the design's `Fa` results                      |
| `/dashboard?state=notifications`      | Notifications and invitation actions                            |
| `/dashboard?state=offline`            | Offline preview; real online/offline browser events also work   |
| `/dashboard?state=meeting`            | Meeting dialog and copy-link action                             |
| `/clients`                            | Design-reference client cards and status filters                |
| `/clients/profile`                    | Client overview, sessions, notes and custom-content tabs         |
| `/chats`                              | Desktop/tablet conversation; phone conversation list            |
| `/chats?state=empty`                  | Arabic empty conversation state                                 |
| `/chats?state=list`                   | Conversation list                                               |
| `/chats?state=thread`                 | Sara's conversation, including the phone thread                 |
| `/chats?state=offline`                | Offline warning and disabled outgoing messages                  |
| `/chats?state=collapsed`              | Collapsed desktop chat navigation                               |
| `/sessions`                           | All, Previous, Upcoming, Today filters and 16 demo fixtures     |
| `/sessions?state=schedule`            | Schedule a new session                                          |
| `/sessions/upcoming`                  | Client overview, preparation, clinical summary and pathway      |
| `/sessions/upcoming?state=actions`    | Reschedule/delete menu                                          |
| `/sessions/upcoming?state=record`     | Notes, exercises, outcome, continuity note and follow-up flags  |
| `/sessions/upcoming?state=create`     | Create homework dialog                                          |
| `/sessions/upcoming?state=library`    | Homework library, search and content filters                    |
| `/sessions?state=expanded`            | Expanded phone navigation drawer                                |
| `/profile`                            | Profile summary, professional credentials and contact details   |
| `/profile/settings`                   | Account settings, availability and logout                       |
| `/profile/help`                       | Support, FAQ, contact form and explicit demo call/chat feedback |
| `/profile/settings?state=edit`        | Edit profile form                                               |
| `/profile/settings?state=password`    | Change-password validation demo                                 |
| `/profile/settings?state=preferences` | Notification switches                                           |
| `/profile/settings?state=hours`       | Working days and time ranges                                    |
| `/profile/settings?state=holidays`    | Add/remove local vacation dates                                 |
| `/profile/settings?state=logout`      | Logout confirmation                                             |
| `/profile/help?state=faq`             | Expandable FAQ                                                  |
| `/profile/help?state=contact`         | Contact-support form                                            |
| `/wallet`                             | Overview, metric cards and monthly chart                        |
| `/wallet?state=earnings`              | Session earnings and transaction statuses                       |
| `/wallet?state=withdrawals`           | Withdrawal history and request action                           |
| `/wallet?state=withdraw`              | Payment-method selector                                         |
| `/wallet?state=shamcash`              | Shamcash request form                                           |
| `/wallet?state=haram`                 | Al-Haram request form                                           |

All screens respond to desktop, tablet, and phone widths. The tablet dashboard uses an icon rail; phones use a navigation drawer. Dialogs support Escape, keyboard focus containment, and focus restoration. Motion respects `prefers-reduced-motion`.

### Demo-only functionality

**This section describes the development reference mode only, not live mode.** Valid-looking login/signup inputs simulate navigation; any complete five-digit code opens the demo dashboard. No account is created, password stored, email sent, or OTP checked by a server. Google, password reset, meeting joining, notifications, patients, and statistics are not connected to APIs in this mode. Notification accept/deny updates local state only. Clipboard copying uses the browser's Clipboard API where permitted.

Sessions and Messages open the second file's screens; Wallet and Open Profile open the third file's screens. Client Review and Patients open the consolidated file's client cards and profile tabs. Switch Overview, Sessions, Notes and Custom Content within the profile; these tab selections are local state, not query-string deep links. Messages, attachments, scheduling, rescheduling, notes, homework and outcomes operate in component memory only; refreshing or leaving the page resets them. No message, file, calendar change, clinical record, supervisor alert or client notification is sent to a server. Delete requires confirmation and only exits the demo detail view. A standalone Additional Content page remains unavailable; custom content is presented within the client profile. Some earlier frames named “Manage Clients” actually contain settings/support, not a client list.

Profile edits, notification preferences, working days and vacations are local component state, preserved between the three profile tabs until leaving that area or reloading. Password validation never changes or stores a password. Support forms, sample phone numbers and live-chat actions never send a message or place a call. Logout only returns to the sign-in demo. Withdrawal submission validates the method-specific fields and the 500–12,500 SP range, then displays a **preview**; no financial request is sent, no balance is deducted, and no transaction is persisted. Payment details are not written to browser storage. On phones, tap Net Available Balance for withdrawals or Monthly earnings for earnings; the menu drawer also opens Wallet.

The Figma fixtures inconsistently use Mark lory in the session header and Ahmed in the homework/response area. The default preview retains those labels; opening a patient from the session list uses the selected patient's name. The source's preparation view highlights “Session record”; this implementation highlights the tab whose content is actually displayed. SF Pro is not bundled; the locally hosted IBM Plex Sans/Inter fonts provide the fallback. Additional session fixtures complete the source's 16/6/8/2 filter totals.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit
npx playwright install chromium
npm run test:visual
```

- **Component/security/contract tests:** bearer handling, refresh/logout races, actor isolation, protected routing, query-string navigation, client-profile authorization, authentication, profile settings, care records, chat/polling and idempotent withdrawal recovery. Opt-in `tests/api-laravel-contract.test.ts` performs eight HTTP checks against synthetic, disposable Laravel fixtures; it is skipped in the ordinary offline run.
- **119 historical browser baselines:** 67 earlier tests plus 52 third-file tests. Visual repairs intentionally change their appearance; these old application snapshots are not current Figma acceptance criteria and were not automatically replaced. Current comparisons are documented below.
- Baselines were generated on **Linux using the pinned Playwright Chromium**. Other operating systems may render fonts differently. Use Linux for consistent baseline comparisons.
- `npm run test:visual:update` intentionally replaces the application baselines; review changes before committing them.

### Visual fidelity — what the tests prove

The historical screenshot tests compare the implementation with **its own reviewed baselines**, not with Figma pixels. Passing them detects future visual regressions; it does **not** prove 100% Figma parity. The bounded closure pass below instead compared fresh React captures with all original-size references extracted through the Figma browser, without MCP.

### Bounded closure — visual acceptance passed with minor differences

The final scoped inventory contains **161 reference entries: 159 meaningful page/state frames and two shared background assets**. Every meaningful frame has a reachable React counterpart; responsive variants and dialogs are states of shared components, not 159 unrelated routes. Original PNG references are now available for every entry. Newly implemented client cards and client-profile Overview/Sessions/Notes/Custom Content routes retain separate development-only fixtures and live API implementations. Fixture entry points require `import.meta.env.DEV` and explicit `VITE_DEMO_MODE=true`; production builds retain live authentication even when that flag is set.

The earlier two-round acceptance at `6d9be7c` ended with 110 minor-accepted and 51 blocking entries. The user then explicitly authorized one additional parallel closure round: 12 independent page/asset owners plus integration and bounded corrections. In Chromium 137 at DPR 1, all **161/161** original/current pairs at `a86be48` were independently inspected at logical inventory viewport dimensions, without stretching references to shadow/export bounds. All historical blockers were resolved; one newly identified phone Wallet overview drawer was 28px too tall.

That sole remaining blocker was corrected at `42f43a4`: the phone overview drawer is 675px tall, while both earnings reference drawers remain 703px. Verification captured **161 fresh current images**: 153 were pixel-identical to the previously inspected revision; all eight changed rasters and six additional regression pairs were directly reinspected. Thus **14 judgments were directly reverified and 147 carried forward with fresh pixel-identical evidence**. Final reconciled classifications: **161 minor differences accepted, zero blocking, zero unqualified accepted**; zero missing, unreachable, aliased or untested canonical counterparts. These are frame classifications, **not pixel-similarity percentages or a claim of exact font parity**. Costaline fallback, minor grain, shadows and wrapping differences remain documented. The two shared background assets were inspected in their authentication consumers, not as completely unobscured raster matches.

Fresh delta verification passed **118 browser assertions**: 66 drawer/navigation checks and 52 native Wallet checks across desktop/tablet/phone, including blank internal dialog padding, preservation of four entered values, menu-only Escape, actual backdrop dismissal and focus restoration. Canonical captures have no horizontal overflow, broken images, browser exceptions, console errors or failed requests; all **216 source/asset fingerprints** stayed unchanged during testing. The isolated production guard, unrelated interactions and complete 161-state 320px sweep are inherited unchanged from `a86be48`; that sweep has no overflow or page exceptions, but two uncached-font requests intentionally failed in one offline state. Initial helper expectation/coordinate errors and corrected successful replays are disclosed in the report.

Final shell checks: **461 tests passed**, eight opt-in tests skipped in that run and **8/8 passed separately earlier in this round** against fresh disposable synthetic Laravel/SQLite data. Typecheck/build and dependency audit passed with zero vulnerabilities; lint has zero errors and seven existing Fast Refresh warnings. CSS/DOM contract tests are not visual acceptance.

The authoritative matrix, report, comparison evidence and current recording are delivered with [PR #4](https://github.com/abOOd-Hj-DeV/therapy-dashboard/pull/4). **This explicitly authorized additional closure round is complete; no further repair loop or merge is authorized.** Isolated production routing checks are not real authentication or production backend validation: real delivery/payments/clinical saves/calls/uploads, native OS IME and cross-browser behavior remain unverified. Backend security findings remain deferred and block production-readiness claims. No reference screenshots replace React DOM.

### Historical extraction provenance — superseded by the complete final pass above

The following three-file tables describe the earlier extraction/testing stages only. Their old downscaled/missing-reference limitations no longer describe the final 161-entry reference set.

| Screen/state          | Figma evidence used                          | Browser coverage                                    |
| --------------------- | -------------------------------------------- | --------------------------------------------------- |
| Desktop/phone sign in | Exported references and design context       | Desktop/tablet/phone snapshots                      |
| Create account        | Desktop context and phone export             | Desktop/tablet/phone snapshots                      |
| Verification          | Desktop context; responsive frame inventory  | Desktop/tablet/phone snapshots; OTP component tests |
| Default dashboard     | Desktop/tablet/phone exports and context     | All three sizes                                     |
| Collapsed navigation  | Desktop export/context                       | Desktop snapshot                                    |
| Expanded navigation   | Phone frame inventory                        | Phone snapshot and drawer interaction               |
| Search                | Desktop export/context; responsive inventory | All three sizes and search interaction              |
| Notifications         | Desktop export/context; responsive inventory | All three sizes and invitation interaction          |
| Offline               | Desktop export/context; responsive inventory | All three sizes and browser connection events       |
| Meeting               | Desktop export/context; responsive inventory | All three sizes and modal keyboard behavior         |

Tablet/phone overlay variants and OTP were implemented from shared design context/inventory; each was tested in the app, but not individually compared to a dedicated Figma export. Minor background texture, font, icon, spacing, and scaling differences may remain. No new Figma requests were made after the first file's **20-attempt** budget.

### Second-file evidence and limits

Source: [Figma file 2](https://www.figma.com/design/dbEbuybwc2dUDJ9QCwNjWL/Untitled). The new `figma-remote` connection was verified, and its 20-attempt budget was exhausted before implementation. Contexts, exports and assets were cached locally; no additional design requests were made. Figma screenshots are references only, never application assets.

| Screen/state                   | Dedicated cached Figma export                              | Browser coverage                                                                 |
| ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Chats                          | Desktop `2:308`, tablet `2:1056`                           | Both sizes, plus phone list/thread                                               |
| Empty chat                     | Desktop `2:727`                                            | All three widths                                                                 |
| Phone chat list/thread         | `2:1667`, `2:1484`                                         | Dedicated phone snapshots and replies/back navigation                            |
| Offline chats                  | Variant inventory, shared chat contexts                    | All three widths and real browser events; no dedicated offline export comparison |
| Sessions/scheduling            | Desktop `2:2089`, tablet `2:2644`, phone `2:3329`          | All three widths, form submission and patient navigation                         |
| Preparation/actions            | Desktop `2:3712`, tablet `2:3942`, phone `2:5860`          | All three widths; clinical summary and overflow menu                             |
| Session record                 | Phone `2:5047`; desktop visible beneath dialogs            | All three widths and note/outcome interactions                                   |
| Create homework                | Desktop `2:6338`, phone `2:5230`                           | All three widths and creation/removal                                            |
| Homework library               | Desktop `2:6618`, phone `2:5445`                           | All three widths, filtering and duplicate prevention                             |
| Tablet record/homework dialogs | Shared desktop/phone contexts, tablet preparation geometry | Tested in the app; no dedicated tablet record/dialog export                      |

Direct export comparisons guide geometry and refinement; downscaled Figma exports, native form controls, focus indicators and the documented source inconsistencies prevent an honest claim of **100% pixel parity**. The app-owned baselines remain regression tests, not a Figma parity score.

### Third-file evidence and limits

Source: [Figma file 3](https://www.figma.com/design/RalEn8SStVMJf2KPmpePTk/Untitled), accessed through **figma33**. Twenty design-tool attempts were counted, including two oversized inventory failures and two Starter-plan-limit failures. Two compact inventories and fourteen design contexts/screenshots were cached; implementation and refinements made no further Figma calls. Only needed downloaded assets were copied locally; no Figma screenshot or temporary asset URL is used in production.

| Screen/state               | Directly reviewed cached Figma reference                             | App coverage                                                                                            |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Profile                    | Desktop context/export                                               | All three widths; phone layout adapted from mobile settings, **not** a successful mobile-profile export |
| Settings                   | Desktop and mobile contexts/exports                                  | All three widths and settings navigation                                                                |
| Support/help               | Desktop context/export, mobile background beneath FAQ                | All three widths and FAQ/contact actions                                                                |
| FAQ                        | Mobile context/export                                                | All three widths and disclosure behavior                                                                |
| Wallet overview            | Desktop and mobile contexts/exports                                  | All three widths and chart/metric snapshots                                                             |
| Earnings/withdrawals       | Desktop content beneath the withdrawal dialogs and variant inventory | All three widths; adapted tablet/phone lists, not dedicated list exports                                |
| Edit profile               | Desktop context/export                                               | All three widths and save/cancel validation                                                             |
| Notification settings      | Desktop context/export                                               | All three widths; preference save/cancel                                                                |
| Work hours/vacations       | Desktop contexts/exports                                             | All three widths; time/date validation and local updates                                                |
| Contact support            | Desktop context/export                                               | All three widths; explicit unsent-message feedback                                                      |
| Shamcash/Al-Haram requests | Desktop contexts/exports                                             | All three widths, method switching and amount limits                                                    |
| Change password/logout     | Variant inventory and shared dialog conventions                      | All three widths and interactions; **no dedicated export comparison**                                   |

The mobile-profile and change-password context requests failed at the account's Starter limit. The remaining responsive variants use cached shared geometry and metadata, not individually retrieved exports. Native time/date/select controls and accessible focus rings differ from drawn Figma controls. Costaline/SF Pro are not bundled: the count serif uses Georgia and other text uses the existing local fonts. Some source settings frames highlight Dashboard while showing Profile; the app consistently highlights Patients for the profile area. Source labels such as Upcoming/Completed on profile tabs, “Work Hours Management” on the vacation dialog, and mixed dollar/SP/Riyal fixture currencies are retained. Extra demo explanations and validation feedback are intentional additions. These are documented differences, not a **100% parity** claim.

## Structure

- `src/Auth.tsx`: sign-in, signup, verification.
- `src/Dashboard.tsx`: responsive workspace and overlays.
- `src/Workspace.tsx`: shared navigation, topbar, drawer and mobile navigation.
- `src/Chats.tsx`: conversation list, threads, composer and offline behavior.
- `src/Sessions.tsx`: session fixtures, filters and scheduling dialog.
- `src/SessionDetails.tsx`: preparation, records and homework dialog.
- `src/ui.tsx`: shared logo, icons, native dialog.
- `src/data.ts`: typed frontend fixtures.
- `src/styles.css`: design tokens and responsive CSS.
- `src/secondary.css`: scoped second-file responsive layouts.
- `src/Profile.tsx`: third-file profile, settings, support and dialogs.
- `src/Wallet.tsx`: wallet overview, transaction fixtures and withdrawal preview.
- `src/RemainingUI.tsx`, `src/remaining-assets.ts`, `src/remaining.css`: third-file shared controls, local asset mapping and responsive styling.
- `tests/remaining.test.tsx`: third-file component coverage.
- `tests/app.test.tsx`: component behavior tests.
- `tests/secondary.test.tsx`: chat/session component behavior tests.
- `tests/visual/`: Playwright tests and visual baselines.

Routing is deliberately lightweight (`history.pushState`/`popstate`); no routing or UI framework is required beyond React. Development server is served to the network for local/device previews — don't expose it publicly. Build and serve `dist/` for production.
