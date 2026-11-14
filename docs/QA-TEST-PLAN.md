# MR FOP FASHIONS — Final acceptance test plan

**Purpose:** Run this plan only after implementation is frozen and the owner has completed Firebase, Google Drive and Apps Script setup.  
**Current status:** Not executed. The CI build and static source checks are not a substitute for these tests.  
**Test rule:** Use separate accounts for each role. Never use the Super Admin account to prove customer, Finance, Tailor, Institute or Instructor permissions.

## Test accounts and prerequisites

Prepare separate Firebase Authentication accounts and role documents for:

- Customer A and Customer B
- Fashion Manager
- Sales staff
- Fashion Designer / Tailor A and Tailor B
- Finance Officer
- Institute Administrator
- Instructor assigned to one course
- Super Admin

Before testing, verify the correct Firebase project, Email/Password authentication, authorized GitHub Pages domain, current Firestore rules, Super Admin Google Drive Integration settings (OAuth Web Client ID and shared folder ID), Drive folder sharing, Apps Script grader URL (if used), and company payment instructions. Use test-only orders and test-only Drive files; do not use real customer or bank information.

## Acceptance cases

| ID | Area | Test action | Expected result | Status |
|---|---|---|---|---|
| T01 | Deployment | Open the deployed homepage and refresh it; open the Account section, sign in with a test customer and inspect the dashboard; check browser console and network errors. If a render failure is deliberately introduced in a test build, verify that the portal error boundary shows its recovery panel rather than a blank screen. | CI runs a Chromium smoke test for the homepage, standalone public routes and the unauthenticated account login portal. Owner acceptance still requires a real customer sign-in and dashboard test. Homepage and account dashboard render, assets load, no fatal console error; an intentional portal render failure shows the recovery panel. The error boundary is not a substitute for fixing any reproducible underlying account error. | Not run |
| T02 | Responsive design | Test Android portrait/landscape, tablet and desktop widths. | Navigation, cards, forms, modals and account portal remain usable without horizontal overflow. | Not run |
| T03 | Deep links | Open /about, each /collections/{men,women,bridal,traditional,corporate} route, /fabric-gallery, /courses, /admissions, /faq, /privacy, /terms, /register, /login, /customer/orders, /student/lessons and /admin/audit-logs directly, including refresh. | GitHub Pages 404 fallback returns to the SPA; public paths render their dedicated standalone page layouts; account paths open the role-protected portal and focus the matching section where available. | Not run |
| T04 | Authentication | Register a customer, verify email, sign in, sign out, reset password and sign in again. | Authentication lifecycle works; unverified/invalid credentials are handled safely; password reset does not expose account secrets. | Not run |
| T05 | Role isolation | Sign in separately as Customer, Manager, Sales, Tailor, Finance, Institute Admin, Instructor and Super Admin. Check each role's dashboard summaries (including Super Admin customer growth, completed orders, verified order payments and quoted balances), then attempt to open each other's data and actions. | UI visibility and Firestore rules both enforce least privilege; direct Firestore requests cannot bypass role restrictions. | Not run |
| T06 | Customer profile and privacy | Edit profile, export personal data (including refund requests, referrals, corporate enquiries, reviews and saved designs), submit access/correction/deletion requests and inspect status updates. | Customer sees only own records; Super Admin can review; a deletion request is not reported as completed until actual records and retention obligations are reviewed. | Not run |
| T07 | Clothing orders | Submit a custom order, attach reference material, inspect it as staff, prepare a quotation and accept/reject it as customer. | Order ownership, reference media, quotation line items and status transitions are consistent; no order is treated as paid merely because a customer submitted evidence. | Not run |
| T08 | Measurements | Add and edit garment-specific measurements, change units if supported, request verification and review as Tailor/Manager. | Measurements remain private to the owner and authorised staff; unverified measurements are not represented as professionally approved. | Not run |
| T09 | Appointments | Book same-time appointments, assign designers, configure working hours, confirm, propose alternatives, accept, cancel and complete. | Conflicting slots are rejected; assigned designer availability is respected; customer notifications and slot reservations are consistent. | Not run |
| T10 | Production tracking | Change an order through each production stage, add notes/media and update expected delivery date. | Stage history is appended, customer notifications are created and the order timeline reflects the latest state. | Not run |
| T11 | Payment evidence | Customer submits a bank-transfer declaration with a Drive receipt; Customer B attempts to open it. | Evidence is private to the order owner and authorised Finance/Super Admin; other customers and unrelated staff cannot read it. | Not run |
| T12 | Finance verification and refunds | Finance verifies a declaration, retries the same declaration, rejects another; customer requests a refund against a verified payment, attempts a duplicate request against the same payment, then Finance reviews, approves/rejects and records a real transfer reference before marking paid. | Duplicate ledger entries are prevented; refund requests are customer-scoped and limited to one record per verified payment; paid status requires prior approval and a transfer reference; no app-initiated transfer is implied. | Not run |
| T13 | Finance reporting | Record/edit expenses, review POS sales, select reporting periods and export CSV/print report. | Totals reconcile to source records; limitations and excluded refund activity are clearly disclosed. | Not run |
| T14 | Inventory and POS | Add product, stock-in, stock-out, attempt negative stock, create POS sale and print receipt. | Stock movements are recorded atomically; negative stock is blocked; sales and receipts reconcile. | Not run |
| T15 | Fabric, product gallery and customer reviews | Publish/edit/archive a fabric; add a product with multiple image views, colours, fabrics and customisation options; switch gallery views; save a favourite; deliver a test order; submit and moderate a review. | Only active fabrics and approved reviews are public; gallery options render; customer favourites and review records are private and correctly scoped. | Not run |
| T16 | Corporate orders | Submit school/corporate/church bulk enquiry and review it as Manager/Super Admin. | Customer sees only own enquiry; authorised staff can update status and response; enquiry is not represented as a confirmed quotation or delivery. | Not run |
| T17 | Loyalty and referrals | Adjust customer points/tier, inspect transaction history, submit referral and review/qualify/reject it. | Points changes are recorded in history; referral status does not silently award points; only authorised staff can adjust benefits. | Not run |
| T18 | Public content | Update company profile, payment instructions, FAQs and public media; submit a newsletter subscription with consent and attempt one without consent; verify a normal customer cannot read subscriber records and Super Admin can refresh/export the list; test public and private views. | Public profile, active FAQs and published media are visible; newsletter sign-ups require explicit consent and subscriber records are Super Admin-only; bank instructions and unpublished/private media remain restricted. | Not run |
| T19 | Institute admissions | Create course/intake, submit applications at capacity, admit/reject applicant and reconcile capacity. | Capacity cannot be exceeded; rejected applications release only the correct reservation; admissions and student IDs remain consistent. | Not run |
| T20 | Institute payments, withdrawal and Drive | Save the Google Drive Integration settings as Super Admin; verify a test learner's payment, grant Drive lesson access, withdraw the learner, check intake capacity and Firestore lesson access, then inspect Drive permission removal and retry after a simulated Drive failure. | Only active paid learners receive Firestore lesson access, progress, attendance and completion/certificate approval; withdrawal releases capacity; Drive permission removal includes unpublished lesson records, and direct/inherited permission limitations are surfaced for retry or owner review. | Not run |
| T21 | Student and instructor learning | Student opens lessons, marks progress, submits assignment/objective assessment; Instructor marks attendance and grades work for assigned courses only. | Student sees only enrolled course data; Instructor sees only assigned course records; answer keys remain private; grading and attendance are auditable. | Not run |
| T22 | Audit and PWA | Trigger each instrumented action, inspect Super Admin audit viewer, install PWA and test offline shell. CI additionally validates the manifest base path, service-worker registration and cached offline navigation. | Audit entries are append-only and visible only to Super Admin; installation and offline fallback work on supported devices. | Not run |

### Automated Firestore Emulator checks

The deployment workflow runs a Chromium browser smoke test, scripts/verify-platform.mjs and scripts/verify-firestore-rules.mjs against the Firestore Emulator. It covers privacy request ownership, refund lifecycle and duplicate prevention, appointment ownership and confirmation/slot reservation, referral ownership, public/archived fabric visibility, product gallery write permissions and deny-by-default. This is a focused regression suite, not a complete test of every collection and role.

### Additional source-level feature check

- Public sitemap includes all currently supported public deep-link routes and excludes private account routes. The sitemap is static and must be updated whenever a new public route is introduced.

- Change every style recommender preference and confirm that the three suggestions and WhatsApp brief reflect the selected occasion, category, garment, colour, personal style, budget and optional reference notes. Confirm that suggestions are not presented as live stock or confirmed prices. This browser test remains Not run until performed.

## Completion criteria

- All cases pass using the separate role accounts.
- No critical permission-denied or data-leakage defects remain.
- No duplicate payment, appointment-slot or enrolment-capacity records are created under concurrent actions.
- Google Drive permissions are verified independently from Firestore course access.
- Current Firestore rules are published and tested against the same Firebase project used by the deployed site.
- Any unsupported or owner-dependent integration is recorded as a blocker, not marked passed.

**Do not mark this plan complete based on CI alone.** The current CI workflow checks production compilation, Chromium public/account-login rendering, static source guardrails and the focused Firestore Emulator suite; it does not sign in to a real customer account, upload to Drive, run the Apps Script grader or simulate all separate production roles.
