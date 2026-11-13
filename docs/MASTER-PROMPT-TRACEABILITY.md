# 24-section master-prompt traceability register

**Project:** MR FOP FASHIONS COMPANY NIGERIA LIMITED  
**Repository:** https://github.com/Scholar94/mrfob  
**Assessment date:** 13 November 2026  
**Purpose:** Track implementation honestly against every section of the supplied master prompt. A source-code implementation is not considered production-verified until its Firebase rules, external setup and real-user workflow have been tested.

## Status definitions

- **Implemented in source:** a usable code path exists, but may still need owner configuration or live verification.
- **Partial:** some requirements exist, while other named workflows or modules remain missing.
- **Placeholder / deferred:** explicitly not implemented; the application must not claim it is available.
- **Not verified:** source exists but end-to-end behaviour, deployment, permissions or external integration has not been tested with real accounts.

## Section-by-section assessment

| Section | Requirement area | Current status | Evidence / remaining work |
|---|---|---|---|
| 1 | Role and development objective | Partial | React/Vite application with public site, customer portal, staff workspace and Institute workspace. Still not a complete implementation of every requested business workflow. |
| 2 | Company information | Partial | Official company details are used in the site. Public company profile can be edited by Super Admin. Payment instructions are separately stored and restricted. Verify account name and bank details with the company before publishing. |
| 3 | Brand identity and design | Partial | Wine/gold premium visual system and supplied approved logos are integrated. Homepage still uses some stock imagery where no approved company media has been supplied; replace those with approved company photographs when available. The public FAQ can now use manager-managed Firestore entries with a built-in fallback. |
| 4 | Homepage experience | Partial | Responsive one-page homepage, collections, services, Institute section, contact/location, public media, theme-music player, reviews and fabric gallery and a guided preference-based style recommendation tool exist. The style tool produces deterministic starting suggestions and WhatsApp consultation briefs; it is not AI and does not verify stock or pricing. Not all 20 requested sections are distinct pages; newsletter subscription and full content-management controls remain incomplete. |
| 5 | Customer registration and dashboard | Partial | Firebase email/password authentication, customer profile, orders, measurements, appointments, payment history, refund requests, notifications, support, privacy requests, benefits and referrals are present in the account portal. Full dashboard metrics and all requested customer self-service routes are not separate pages. |
| 6 | Online clothing ordering | Partial | Customer order form, reference designs, favourites, quotation/payment workflow, order progress, production media and delivery/collection arrangements exist. Product records now support up to nine views, available colours, fabric options and customisation options; product cards allow image-view selection. A complete standalone product-detail and checkout experience remains incomplete. |
| 7 | Body measurement management | Partial | Garment-specific measurement profiles, units, manual entry, measurement guidance, customer records and designer verification are present. Full illustrated diagram coverage for every measurement and every specialized garment remains incomplete. |
| 8 | AI smart measurement | Placeholder / deferred | AI Measurement Assistant explicitly states that photo-based measurement is not enabled. Manual measurement remains available. No paid AI API, fake estimate or unsupported accuracy claim is used. |
| 9 | Appointment and delivery scheduling | Partial | Appointment requests, admin status updates, alternative proposals, customer acceptance, designer/order assignment and calendar component exist. Conflict-free scheduling across every designer and every appointment type requires live verification and further capacity logic. |
| 10 | Production and tracking | Partial | Production stages, progress updates, expected delivery dates, designer assignment, photos/videos and in-app notifications exist. Complete event audit, automated customer alerts for every transition and all fitting/alteration/delivery scenarios remain to be verified. |
| 11 | Pricing, invoices and payments | Partial | Itemized quotations, customer acceptance, manual bank-transfer declarations, private Drive evidence, Finance review, ledger and printable invoices/receipts exist. Customers can request refunds against verified payments and Finance can record review and completed transfer references. The application does not move money or net refund records from financial statements; full refund accounting and statutory reporting remain incomplete. |
| 12 | Fashion Institute | Partial | Course/application/enrolment, training windows, lessons, Drive materials, attendance, assignments, objective assessments and instructor assignment/profile workflows exist. Institute Admin/Manager/Super Admin can withdraw an admitted paid learner in a Firestore transaction, release intake capacity and disable Firestore lesson access; direct Google Drive permission removal is attempted and can be retried. The Apps Script objective grader requires owner configuration and live verification. Full learning lifecycle and all requested reports/certificate controls need end-to-end testing. |
| 13 | Administrator dashboard | Partial | Role-aware portal includes Super Admin, Manager, Tailor, Finance, Institute and Instructor workflows. Customer, order, inventory, payment, expense, website media, company profile, reviews, benefits and support tools exist. Super Admin overview now includes customer growth over 30 days, completed/delivered orders, verified customer-order payments and outstanding quoted balances alongside operational counts. Full overview charts, complete student/admission/revenue KPIs and every role-specific dashboard summary remain incomplete. A Super Admin-only audit viewer and append-only records for selected privileged actions are now present, including payment, staff role, settings, appointment, order assignment/production, inventory, customer privacy, referral, fabric, FAQ, bulk order, loyalty, Institute admission/payment and Drive lesson permission actions; coverage is not exhaustive. |
| 14 | Communication and notifications | Partial | Firestore in-app notifications, customer support and WhatsApp links exist. Email/SMS/WhatsApp automated delivery is not enabled; no paid messaging provider is introduced. Notification coverage for every listed event needs testing. |
| 15 | Media and Google Drive | Partial | Direct Drive upload, shared-folder integration, media publishing, private customer/payment evidence and Institute lesson files are implemented in source. OAuth client, Drive folder, staff access, Apps Script and per-file permissions require owner setup and real-account verification. Drive is not DRM. |
| 16 | Installable PWA | Partial | Manifest, service worker, offline fallback and app icons exist. Validate the deployed GitHub Pages base path, installability and offline cache behaviour on Android/iOS/desktop; live mobile installation has not been verified here. |
| 17 | Additional features | Partial | Fabric catalogue, interactive rule-based style recommender, manually administered loyalty/VIP benefits, referral workflow, bulk/corporate order enquiries, verified reviews, CSV/print reports, search and support are present to varying degrees. Automated purchase/referral points and broader personalised recommendations remain incomplete. |
| 18 | Database architecture | Partial | Firestore collections and security rules cover users, roles, orders, measurements, appointments, payments, Institute, reviews, benefits, referrals, fabrics, media and support. Not every proposed collection exists, and a focused Firestore Emulator regression suite now tests owner privacy, refund lifecycle, referral ownership, fabric visibility, product gallery writes and deny-by-default in CI; broader role-by-role Emulator coverage and publication to the live Firebase project remain outstanding. |
| 19 | Zero-cost technology | Implemented as a source constraint; owner verification required | Firebase Storage and Cloud Functions are not used by the application workflow. Google Drive is the media store, GitHub Pages is hosting, and the objective grader is an optional Apps Script integration. Owner must monitor quotas and must not enable billing. |
| 20 | Security and data protection | Partial | Firestore rules implement owner/role checks, private evidence, private customer records, assigned Tailor access, review moderation and restricted settings. Rules have not been demonstrated in Emulator/live tests for every role. The repository source verifier now checks balanced Firestore rule delimiters, a single catch-all deny rule and uniqueness of several high-risk collection rule blocks; this is a structural regression check, not a Firestore Rules compiler or Emulator test. An append-only application audit log now records selected privileged actions across customer benefits, referrals, corporate enquiries, fabric and FAQ changes, privacy requests, payments, appointments, order assignment/production, staff roles, inventory, company/payment settings, Institute admission/payment and Drive lesson permissions. It is readable only by Super Admin. Coverage is not exhaustive and the client-side event writer is not a tamper-proof external ledger. Retention/deletion execution and backup/restore procedures remain incomplete. |
| 21 | Performance and UX | Partial | Responsive layout, loading/error/empty states, a React error boundary around the account portal, image lazy loading and Firestore query scoping are present. The error boundary provides a recoverable fallback for render crashes; it does not prove that the previously reported blank Account view root cause has been fixed. Full pagination, image optimization, accessibility audit and low-bandwidth/mobile profiling remain to be completed. |
| 22 | SEO and brand presentation | Partial | Page metadata, canonical URL, LocalBusiness structured data, robots.txt and a multi-route public sitemap exist. Route-specific title changes are client-side; server-rendered metadata and dynamic sitemap generation remain incomplete. |
| 23 | Required website pages | Not complete | Most public/customer/staff experiences are sections or portal modules rather than the complete independent route list in the master prompt. A GitHub Pages 404 fallback and route resolver now support requested public paths; collection category routes target their corresponding category panels, and course/admissions routes target separate public sections; other public paths scroll to their relevant homepage section. Customer/student/admin paths open the role-protected portal and scroll to a matching portal section where one exists. These are deep-link aliases, not fully independent page components; several requested admin pages such as audit-log-specific routes remain incomplete. |
| 24 | Final delivery and mandatory tests | Not complete | Deployment workflow builds and publishes the site when the latest commit passes. A 22-case manual acceptance plan plus one automated Firestore Emulator regression case is documented in docs/QA-TEST-PLAN.md. Separate-account end-to-end testing, Firebase Emulator rules tests, Drive/Apps Script integration tests, mobile/PWA tests and a final signed-off test report remain outstanding. |

## Recently added workflows

- Account portal render-error boundary: catches React render failures in the account portal and displays a recoverable error message instead of leaving the portal area blank. The original account navigation/blank-page scenario still requires reproduction and testing with the owner’s Firebase account.

- Refund request and manual refund record workflow: customers can submit one refund request per verified payment; Finance/Super Admin can review, approve/reject and record a completed bank-transfer reference. Firestore binds the refund document to its payment and owner. The platform does not initiate transfers or automatically reconcile refunds into POS/statutory accounts.

- Product catalogue enhancement: Super Admin can configure up to eight additional HTTPS image views, colours, fabric options and customisation options; customers can switch product image views and inspect the available design options. Existing product records without the new optional arrays remain eligible for stock adjustments.

- Guided style recommendation wizard: customers choose occasion, category, garment, colour, style direction, budget and optional reference notes, then receive three deterministic starting suggestions and can send the brief to the configured WhatsApp contact. It is not AI, live inventory or a quotation.
- Appointment alternative proposals release the previously reserved confirmed slot in the same Firestore transaction; customer acceptance reserves the proposed slot atomically.

- Customer privacy request centre for access, correction and deletion requests. A request is not an automatic data erasure; staff must review retention requirements and connected Drive records.
- Public fabric catalogue with Super Admin create/edit/archive controls.
- Customer loyalty and VIP benefits panel. Points are currently adjusted manually by Super Admin and recorded in an append-only transaction history.
- Customer referral submission and Super Admin review. Referral status does not automatically award points.
- Corporate and bulk-order enquiry form with customer status visibility and Super Admin / Fashion Manager review.
- Private payment evidence link in Finance review; uploaded evidence is not proof that the bank transfer has cleared.
- Payment review JSX syntax fix was committed after a failed build. Always use the newest Actions run as the source of truth for deployment status.

## External setup still required from the owner

1. Configure Firebase Authentication (Email/Password), Firestore and authorized domain.
2. Publish the current `firestore.rules` to the correct Firebase project.
3. Create the initial Super Admin role document using the owner's actual Firebase Authentication UID.
4. Configure Google Drive API OAuth client, shared folder and required GitHub Actions variables.
5. Configure the optional Google Apps Script grader and its script properties; set the deployed `VITE_ASSESSMENT_GRADING_URL` variable only after testing.
6. Confirm the company bank account names and payment instructions before displaying them to customers.
7. Test all roles with separate accounts; do not use the Super Admin account as the only test identity.

## Next implementation priorities

1. Stabilize the current build and validate Firestore rules before adding more modules.
2. Implement distinct route handling and deep links for the public, customer, student and administration page lists.
3. Complete the dashboard KPI summaries, reports, audit trail and role-specific navigation.
4. Complete refunds, delivery/collection lifecycle, appointment conflict prevention and full production event history.
5. Complete Institute instructor/student lifecycle and validate Drive permission grant/revocation, including refund/withdrawal cases.
6. Complete accessibility, low-bandwidth, SEO route coverage and PWA installation tests.
7. Run the full 22-case manual test plan using separate customer, designer/tailor, finance, instructor, Institute Administrator and Super Admin accounts.

**Completion rule:** The project must not be described as fully complete until all 24 sections have no outstanding critical requirements, the current Firestore rules are published and tested, all external integrations are verified, and the mandatory end-to-end test report is passed.
