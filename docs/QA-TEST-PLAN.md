# MR FOP FASHIONS — Final acceptance test plan

**Purpose:** Run this plan only after implementation is frozen and the owner has completed Firebase, Google Drive and Apps Script setup.  
**Current status:** The AI measurement assistant is a local browser-side pose-estimation preview; its image processing, privacy notice, supported-device performance and draft-prefill workflow still require manual acceptance. The latest production validation passed in GitHub Actions run [#989](https://github.com/Scholar94/mrfob/actions/runs/45661027496) for commit `c860acb12468641187c5bca9c046c2c630a1d2ec` on 25 November 2026. It passed production Firebase-secret preflight, build, Chromium browser smoke tests, platform source guardrails, Firestore Emulator security tests, Pages artifact upload and GitHub Pages deployment. The 26 owner-operated acceptance cases below remain **Not run** and must be completed with separate role accounts and test data; Drive/Apps Script and physical-device acceptance are not covered by CI.  
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
| T03 | Deep links | Open every required route directly, including refresh: public routes /, /about, /collections, /collections/{men,women,bridal,traditional,corporate}, /fabric-gallery, /fashion-institute, /courses, /admissions, /contact, /faq, /privacy and /terms; customer routes /register, /login, /customer/{dashboard,profile,orders,new-order,measurements,ai-measurement,appointments,payments,notifications,support}; student routes /student/{dashboard,profile,courses,lessons,assignments,attendance,results}; and admin routes /admin/{dashboard,customers,orders,measurements,appointments,production,quotations,payments,invoices,designers,fashion-gallery,fabrics,courses,training-windows,applications,students,instructors,media,reports,settings,users,audit-logs}. | GitHub Pages 404 fallback returns to the SPA; valid public paths render their dedicated standalone page layouts; an unknown URL displays the branded 404 recovery page with a homepage link; account paths open the role-protected portal and focus the matching section where available. CI includes a Chromium regression check for the unknown-route experience. | Not run |
| T04 | Authentication | Register a customer, verify email, sign in, sign out, reset password and sign in again. | Authentication lifecycle works; unverified/invalid credentials are handled safely; password reset does not expose account secrets. | Not run |
| T05 | Role isolation | Sign in separately as Customer, Manager, Sales, Tailor, Finance, Institute Admin, Instructor and Super Admin. Check each role's dashboard summaries (including Super Admin customer growth, completed orders, verified order payments and quoted balances), then attempt to open each other's data and actions. | UI visibility and Firestore rules both enforce least privilege; direct Firestore requests cannot bypass role restrictions. | Not run |
| T06 | Customer profile and privacy | Edit profile, export personal data (including refund requests, referrals, corporate enquiries, reviews and saved designs), submit access/correction/deletion requests and inspect status updates. | Customer sees only own records; Super Admin can review; a deletion request is not reported as completed until actual records and retention obligations are reviewed. | Not run |
| T07 | Clothing orders | Submit a custom order, attach reference material, inspect it as staff, prepare a quotation and accept/reject it as customer. | Order ownership, reference media, quotation line items and status transitions are consistent; no order is treated as paid merely because a customer submitted evidence. | Not run |
| T08 | Measurements | Add and edit garment-specific measurements, change units if supported, request verification and review as Tailor/Manager. | Measurements remain private to the owner and authorised staff; unverified measurements are not represented as professionally approved. | Not run |
| T09 | Appointments | Book same-time appointments, assign designers, configure working hours, confirm, propose alternatives, accept, cancel and complete. | Conflicting slots are rejected; assigned designer availability is respected; customer notifications and slot reservations are consistent. | Not run |
| T10 | Production tracking | Change an order through each production stage, add notes/media and update expected delivery date. | Stage history is appended, customer notifications are created and the order timeline reflects the latest state. | Not run |
| T11 | Payment evidence | Customer selects one of the verified company bank accounts, copies its account number, submits a bank-transfer declaration with a Drive receipt; Customer B attempts to open it. | Evidence is private to the order owner and authorised Finance/Super Admin; other customers and unrelated staff cannot read it. | Not run |
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
| T22 | Audit and PWA | Trigger each instrumented action, inspect Super Admin audit viewer, install PWA and test offline shell. CI additionally validates the manifest base path, service-worker registration and cached offline navigation. | Audit entries are append-only and visible only to Super Admin; installation and offline fallback work on supported devices. | Not run |\n| T23 | AI measurement assistant | On a supported mobile/desktop browser, give explicit consent, select a test-only full-length front photo and enter known height; analyse pose, test poor/partial images, copy estimates into the manual form, clear the photo and inspect browser network/storage. | Pose inference runs locally; no customer image is sent to Firebase, Drive or MR FOP servers; only shoulder span, sleeve path and hip-to-ankle estimates appear; estimates are clearly unverified, circumferences remain manual, and copied values are draft-only pending tape measurement and designer verification. | Not run |

| T24 | Catalogue-to-order handoff | Sign in as a customer, choose an active catalogue design and select Request this design. Review the prefilled custom-order form without submitting it. | The existing order form is prefilled with the design name and available first fabric/colour choices where present. No order is created until the customer submits; the final price and availability remain subject to staff quotation. | Not run |
| T25 | Operations quality centre | Sign in separately as Manager, Sales, Tailor, Finance and Super Admin. Review only the panels appropriate to each role; use a test dataset with overdue orders, same-slot appointments and pending transfer declarations. Export each available report as Super Admin. | Role-specific panels show only the already-authorised datasets. The centre is read-only, flags potential exact-slot conflicts without changing bookings, and exports operational CSV without customer contact details. Finance reminders never imply that uploaded evidence proves cleared funds. | Not run |
| T26 | Measurement field guidance and appointment review | Open each garment measurement profile and expand the field-by-field instructions. In the admin calendar, create test bookings sharing the same date, start time and assigned designer. | Each profile displays field-specific tape placement guidance. The calendar flags exact same-slot groups for human review without cancelling, moving or confirming any appointment. | Not run |

### Automated Firestore Emulator checks

The deployment workflow runs a Chromium browser smoke test, scripts/verify-platform.mjs and scripts/verify-firestore-rules.mjs against the Firestore Emulator. It covers cross-customer profile/order/payment privacy, self-role escalation denial, assigned-tailor isolation, non-negative inventory stock, movement-to-stock consistency, immutable inventory ledger and atomic POS sale/stock/movement writes, POS/expense role permissions, privacy request ownership, refund lifecycle and duplicate prevention, appointment ownership and confirmation/slot reservation, Institute schedule-lock privacy and withdrawal, newsletter consent and subscriber privacy, Drive configuration, referral ownership, public/archived fabric visibility, product gallery write permissions and deny-by-default. Chromium also checks homepage overflow at four viewport widths, all customer/student/admin account entry routes, and that style recommender preferences are carried into the WhatsApp consultation brief. These are focused regression checks, not a complete test of every collection, authenticated role workflow or physical device.

### Additional source-level feature check

- Public sitemap includes all currently supported public deep-link routes and excludes private account routes. The sitemap is static and must be updated whenever a new public route is introduced.

- The automated Chromium smoke test now changes occasion, category, garment, colour, personal style, budget and reference notes, then verifies the consultation brief carries those selections. Owner acceptance must still confirm the visible suggestions are appropriate and are not presented as live stock or confirmed prices.

## Completion criteria

- All cases pass using the separate role accounts.
- No critical permission-denied or data-leakage defects remain.
- No duplicate payment, appointment-slot or enrolment-capacity records are created under concurrent actions.
- Google Drive permissions are verified independently from Firestore course access.
- Current Firestore rules are published and tested against the same Firebase project used by the deployed site.
- Any unsupported or owner-dependent integration is recorded as a blocker, not marked passed.

**Do not mark this plan complete based on CI alone.** The current CI workflow checks production compilation, Chromium public/account-login rendering, static source guardrails and the focused Firestore Emulator suite; it does not sign in to a real customer account, upload to Drive, run the Apps Script grader or simulate all separate production roles.


## Additional regression check — local calendar dates

- On a device set to the business's local timezone (including Nigeria, UTC+1), open Institute attendance, intake application deadlines, announcement expiry and corporate/bulk-order preferred completion dates.
- Verify the default attendance date and minimum selectable preferred completion date match the calendar date displayed by the device, including shortly after local midnight.
- Change the device timezone in a test environment and repeat. Date-only business fields must remain date-only and must not shift to the previous/next day because of UTC conversion.
- CI source guardrails now ensure the Institute and corporate request forms use local calendar date helpers rather than `toISOString().slice(0,10)`. This static check complements, but does not replace, device testing.


## Super Admin System Control Centre — acceptance tests

The System Control Centre is mounted only for authenticated Super Admin claims. Verify these cases in a staging or controlled production account before routine use:

- [ ] Super Admin can browse each configured business-information category and load additional pages.
- [ ] Super Admin can search visible records and move a selected record to the Recycle Bin after typing DELETE.
- [ ] A moved record disappears from its active collection and appears in the Recycle Bin with its original path and deletion metadata.
- [ ] Super Admin can restore a record and confirm it returns to its original collection or supported order subcollection.
- [ ] Permanent deletion requires typing PERMANENTLY DELETE and removes only the selected Recycle Bin entry.
- [ ] Non-Super Admin users cannot read or mutate adminRecycleBin or use the broad Super Admin data-management permissions.
- [ ] The current Super Admin cannot delete their own user profile; role documents and audit logs remain protected.
- [ ] Inventory movement and loyalty transaction ledgers remain immutable.
- [ ] Deleting a user profile is not represented as deleting/disabling that user's Firebase Authentication account.
- [ ] Physical Google Drive files are not considered deleted by removing a Firestore metadata record; Drive file deletion requires its separate owner-authorized broker workflow.
- [ ] Confirm order events, progress updates and customer reference records are included through collection-group views.
- [ ] Deploy the updated Firestore rules to the Firebase project, then verify the rules emulator suite and the deployed application before enabling routine administration.

**Release note:** Source changes alone do not publish Firestore security rules. The rules must be deployed to the correct Firebase project separately. Production acceptance remains pending until the deployment and all checks above have been completed.


### Google Drive Trash integration — additional acceptance tests

- [ ] Redeploy the latest Apps Script broker source as a new Web App version using the existing owner execution and Anyone endpoint settings.
- [ ] Verify the Apps Script project still has the correct FIREBASE_PROJECT_ID, FIREBASE_API_KEY and DRIVE_FOLDER_ID Script Properties.
- [ ] As Super Admin, archive a test record with a linked Drive file ID and use Move linked files to Drive Trash.
- [ ] Confirm the matching file is in Google Drive Trash and the Recycle Bin record records the cleanup result.
- [ ] Confirm customer and staff sessions are rejected by the broker even if they manually submit the endpoint action.
- [ ] Confirm a file outside the configured company root folder is rejected and no selected files are moved.
- [ ] Confirm a file already in Trash is safely reported as already trashed.
- [ ] Confirm a restored Firestore record does not falsely imply its Drive file was restored.
- [ ] Deploy Firestore rules to the exact production Firebase project and run the rules emulator tests before enabling the console for live administration.
