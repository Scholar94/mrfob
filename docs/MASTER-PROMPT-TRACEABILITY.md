# MR FOP FASHIONS — Master Prompt Traceability Register

**Controlling specification:** the user-supplied *MASTER DEVELOPMENT PROMPT: MR FOP FASHIONS COMPANY NIGERIA LIMITED* (24 major sections; source file 1,540 lines).
**Repository:** `Scholar94/mrfob`
**Working branch:** `main` (direct live deployment as changes are completed)
**Purpose:** prevent omissions and provide evidence-based completion tracking. This register does not itself mean a feature is implemented.

## Status definitions
- **Implemented (code-reviewed):** relevant implementation is present in source; live workflow still requires testing unless separately recorded.
- **Partial:** some elements exist, but one or more explicit requirements are absent.
- **Not implemented:** no implementation found in the reviewed source.
- **Dependency:** requires owner-supplied asset, account, configuration or decision.
- **Verify:** code exists but must be checked in the running application or service.

## Master requirement register

| ID | Master prompt section | Required scope to preserve | Current source assessment |
|---|---|---|---|
| MP-01 | 1. Role and development objective | Integrated production-ready fashion business platform for customers, designers, students, instructors and administrators; all major features functional; no fake controls or forms | Partial — current app is an early integrated foundation, not the full platform |
| MP-02 | 2. Company information | Official name, RC 1089546, established 2010, full Bonojo Road/Eka Junction address, email, telephone/WhatsApp, opening hours, business categories, mission, vision; Loma and FCMB payment details; backend-configurable company/contact/bank settings; keep confidential admin data private | Partial — official name, RC, year, telephone, email, full address and opening hours now appear on the public homepage; configurable company/contact/bank settings and payment-account management are not implemented |
| MP-03 | 3. Brand identity | Wine/burgundy, gold, black, white/ivory; luxury typography, responsive premium design, animation, galleries; actual uploaded company media must take precedence over stock images | Partial — premium visual direction exists; supplied brand assets/media integration and complete galleries are outstanding |
| MP-04 | 4. Homepage experience | Welcome experience; company introduction; enable-music interaction with play/pause, volume, mute and remembered preference; retrieve official song from Drive; 20 specified homepage sections including about, collections, men, women, bridal, industrial, uniforms, institute, ordering, why-us, featured designs, testimonials, projects, FAQ, contact, Maps, WhatsApp and optional free newsletter | Partial — hero, welcome/story, collection tiles, services, institute, promise, contact, WhatsApp and a new industrial/corporate tailoring section are present. A five-step ordering guide and six-item FAQ are now present, alongside the earlier sections. The full 20-section experience, functional company music controls/Drive song, featured projects, testimonials, Maps and other requested sections remain outstanding |
| MP-05 | 5. Customer registration/dashboard | Name, email, telephone, password, optional photo; secure register/login/logout/password recovery/profile update; personal dashboard showing profile, current/past orders, measurements, measurement/sewing/fitting appointments, collection/delivery dates, payment history/status, training applications, notifications and designer messages; strict own-record access | Partial — Firebase email/password registration/login/logout, profile, orders, appointments, measurements, payments and training enquiries exist; phone is profile-editable, but password recovery, photo, full dashboard modules, notifications/messages and complete appointment/delivery views are missing |
| MP-06 | 6. Online clothing ordering | Full men's/women's/special-services category taxonomy; detailed gallery fields and multi-image views; reference-image upload; favourites; order configuration (category/design/fabric/colour/quantity/instructions/reference image/measurement and fitting preferences/proposed completion date/time/delivery or collection); review before submission; unique reference | Partial — basic admin-created orders and basic product catalogue exist; customer custom-order request form now captures category, garment, fabric, colour, quantity, measurement arrangement, preferred completion date and collection/delivery preference; Firestore owner rules constrain submissions and edits. Reference-image upload, favourites, full catalogue taxonomy/gallery and full review/quotation workflow remain missing |
| MP-07 | 7. Body measurement management | Garment-specific men's and women's measurement fields; cm/in units; visual guides; validation and unusual-value warnings; multiple named measurement profiles and reuse; in-person booking; designer approve/reject/alternative date; notifications; prevent conflicts; professionally enter/verify measurements | Partial — garment-specific profiles, cm/in conversion, general chest/waist/hip illustration, advisory plausibility warnings, named profile reuse, designer review metadata and a shortcut to request in-person measurement verification are implemented. Full garment-specific diagrams, designer-entered measurements, complete accept/reject/alternative review workflow, notifications and robust server-side appointment conflict prevention remain outstanding |
| MP-08 | 8. AI measurement assistant | Optional front/side full-body image workflow; body profile, height, garment, instructions and consent; computer vision only if technically supported; estimates/confidence/calibration/photo suitability; retake guidance; never auto-approve; designer verification; privacy, retention/deletion; free-tier fallback clearly labelled | Not implemented — no AI measurement page or workflow. Must not claim accurate AI measurements; free manual workflow remains the supported path until a viable free implementation exists |
| MP-09 | 9. Appointment and delivery approval | Measurement/fitting/completion/collection proposals; admin calendar with customer/order/date/time/type/designer/status; approve/reject/suggest alternatives/message; customer accept/decline alternative; only approved slots confirmed | Partial — basic appointment request and simple status dropdown exist; separate appointment types, alternatives, customer response, calendar, conflict prevention and delivery scheduling absent |
| MP-10 | 10. Production and tracking | 18 defined production stages from received/review/measurements/quotation/deposit through fabric/cutting/sewing/finishing/inspection/fitting/alterations/completion/collection/dispatched/delivered; dated progress history, expected completion, designer messages, approved collection date, progress photos and notifications | Partial — all 18 production stages are available to administrators; stage changes create immutable timestamped events; customers see their event history, current status, payment status and a visual stage-progress indicator. Expected completion management, designer/customer messages, approved collection scheduling, progress photos and notifications remain outstanding |
| MP-11 | 11. Pricing, invoices and payments | Configurable design/fabric/labour/customization/urgent/delivery/discount/bulk prices; quotation with itemized costs, deposit/balance/terms and customer accept/reject; configurable bank accounts; customer transfer confirmation, reference and evidence upload; admin-only verification; statuses; balance calculation; downloadable PDF invoices/receipts | Partial — POS sales, separate payment transaction recording, expenses and printable receipts exist; customer payment evidence, verification workflow, quotations, pricing rules, automatic balance calculation and invoice workflow are absent. Existing payment records do not automatically reconcile order balances |
| MP-12 | 12. Fashion Institute | Configurable courses; online/onsite modes; learning materials, video lessons, modules, assignments, announcements, assessments and progress; onsite venue/sessions/dates/duration/fees/materials/schedules; full applications and unique refs; configurable training windows/capacity/instructor/timetable/deadlines; admissions; training payments; student and instructor portals with all listed learning, attendance, assessment and certificate functions | Partial — course creation/catalogue, training-window creation and closure, customer application submission with unique reference, admin admission/rejection/request-information decisions and student ID assignment are implemented. Course editing/archiving, atomic capacity allocation, student/instructor portals, verified training payments, learning content, assignments, attendance, assessments and certificates remain outstanding |
| MP-13 | 13. Administrator dashboard | Overview metrics for customers/orders/measurements/appointments/quotations/payments/revenue/balances/students/applications/sessions; charts; all 25 management modules; Super Admin, Fashion Manager, Fashion Designer, Finance Officer, Institute Administrator and Instructor role permissions enforced in rules/backend | Partial — staff/customer/order/appointment/payment/inventory/POS/finance modules exist; requested roles and many modules/metrics absent; current role set is superAdmin, manager, sales, tailor, institute |
| MP-14 | 14. Communication and notifications | Internal notifications for every listed customer/order/quotation/payment/appointment/measurement/production/fitting/delivery/training/admission event; unread indicators; WhatsApp links; only genuinely free/permitted email; no promise of unlimited SMS/email | Not implemented — WhatsApp contact link exists; no internal notification centre or unread state |
| MP-15 | 15. Google Drive and media | Organized Drive folders for branding, homepage, fashion categories, uniforms, institute, training videos, theme song, customer references, production photos and promos; secure Apps Script/Drive integration; Firestore metadata; private customer files; clear disclosure if integration unavailable | Not implemented — no Drive integration; no unrestricted exposure of private assets permitted |
| MP-16 | 16. Installable PWA | Android/iPhone/tablet/Windows/Mac/browser support; manifest, custom icon, splash, install prompt, service worker, offline fallback, responsive navigation/forms, speed/image optimization; cached public/previous info only; never present stale order/payment status as live | Partial — manifest, service worker and install control exist; offline fallback page, robust cache strategy, status freshness handling and custom supplied app identity need work |
| MP-17 | 17. Additional professional features | Style recommendations; fabric catalogue; configurable loyalty/referrals/VIP; VIP service; corporate/bulk quote requests; verified reviews with admin moderation; full reports; search/filter across all listed entities; support centre/FAQ/contact/order/training/complaint; privacy/terms/consents/refunds/cancellations/training policy/data deletion | Partial — basic sales/finance reports, WhatsApp contact and a public six-item FAQ/order guide exist; loyalty, moderated reviews, full support centre, policies and broader reports remain absent |
| MP-18 | 18. Database architecture | All 30 named collections and relationships; IDs/timestamps/validation; secure customer/student/instructor/designer/finance/admin data access; trusted validation for sensitive actions; no plaintext passwords or frontend secrets | Partial — Firebase Auth/Firestore and some collections/rules exist; most requested collections and authorization domains are absent; security review needed for every new workflow |
| MP-19 | 19. Technology and zero-cost | Free/open-source stack; Firebase Spark only; no card/billing/Blaze/paid Functions/hosting/AI/email/SMS/WhatsApp/maps APIs; Drive media; Firestore free quotas; free PDF/chart tools; no automatic billing or paid calls | Implemented as development constraint in current approach; verify every future dependency and quota before adoption |
| MP-20 | 20. Security/privacy | Auth, RBAC, Firestore rules, validation, file type/size checks, admin security, session handling, audit trails, privacy, backups/exports, private payment evidence/photos/measurements, explicit photo consent, documented super admin setup | Partial — Firebase Auth, role docs and Firestore rules exist; expanded RBAC, uploads validation, audit logs, backup procedure, consent/deletion and several sensitive workflows absent |
| MP-21 | 21. Performance/UX | Nigerian mobile-data optimization; compressed/lazy/responsive images; efficient queries, pagination, search; accessibility; errors/loading/confirmation/empty states; fast mobile-first UI | Partial — lazy-loaded images and responsive styling/loading/empty states exist in places; comprehensive optimization, pagination, accessibility and performance checks outstanding |
| MP-22 | 22. SEO/international brand | Titles, meta descriptions, Open Graph images, structured business data, sitemap, robots.txt, image alt text, SEO category pages and target search themes | Partial — basic title/description/Open Graph title/description and some alt text exist; sitemap, robots, structured data and SEO routes absent |
| MP-23 | 23. Required pages/routes | All 16 public routes, 13 customer routes, 7 student routes and 22 administration routes listed in the prompt; each protected appropriately | Not implemented as specified — current app is mainly a single-page experience with an account portal, not the requested complete route architecture |
| MP-24 | 24. Delivery and mandatory testing | Ten development phases; all 20 mandatory end-to-end tests with separate customer/designer/finance/instructor/admin accounts; source code, responsive site, PWA, DB/rules, Drive, four dashboards, setup/deployment guides, test report and free-tier guide | Partial — repository, deployed site, Firebase foundation, customer/admin portal and deployment workflow exist; complete phases, test coverage, dashboards, Drive integration and documentation remain outstanding |

## Existing working functionality to preserve
- Firebase email/password customer registration and login, email verification, password-reset email request and sign-out.\n- Customer custom-order requests are now implemented in code with Firestore owner-scoped create/read/edit rules (publication and live test pending).
- Firestore role-based Super Admin/staff foundation.
- Staff access management for current roles.
- Customer directory, profile viewing/editing and order history.
- Admin order creation and status/payment-status updates.
- Basic customer appointment booking and admin status updates.
- Separate payment transaction recording and customer payment history.
- Basic customer measurement entry/history and training enquiry/status.
- Product catalogue, product editing, stock-in/stock-out and inventory movement history.
- POS checkout, atomic stock deduction, sales history and receipt printing.
- Financial expense records, P&L-style summaries, period filters, charts, CSV and printable reports.
- Existing deployed Firebase/GitHub Pages configuration and existing business records.

## Work log

- **2026-11-12 — Fashion Institute attendance register:** added an attendance date selector and per-enrollment Present, Absent, Late and Excused actions for authorized Institute administration. Records are keyed by student, course and date to make repeated marking update the same daily record rather than create duplicate rows. Students can view their own attendance history; only Super Admin/Institute/Manager can create or update attendance, and only Super Admin can delete records. Attendance is manually recorded and does not yet include instructor-specific permissions, session timetables, QR/check-in verification, percentage summaries or notifications. Latest Firestore rules must be published in Firebase. Build/deployment and live authorization testing pending.


- **2026-11-12 — Fashion Institute assignments and submissions:** Institute/Manager/Super Admin can publish course assignments with instructions, optional due date and maximum score. Paid students enrolled in the assignment's course can read and submit one text response; students can read their own submission, while authorized Institute staff can review and grade with a bounded score and feedback. Payment verification and enrollment activation are now Super Admin-only in Firestore rules; Institute staff can process admissions but cannot grant paid access. Added `instituteAssignments` and `instituteSubmissions` rules. This is text-based submission only; file uploads, plagiarism checks, late-submission policy, edit/resubmission and notification workflows are not included. Latest Firestore rules must be published in Firebase. Build, deployment and live authorization tests pending.


- **2026-11-12 — Customer quotation workflow:** Added admin quotation amount/notes and send action; customer accept/decline controls; awaiting quotation approval status; Firestore rules constrain admin and owner updates. Build verification pending.

- **2026-11-12 — Appointment alternative workflow:** Added admin proposal date/time/message and customer acceptance; accepting copies the proposal into the appointment date/time and marks it confirmed. Firestore rules limit admin changes and allow only the appointment owner to accept a pending alternative. Automated collision prevention and notifications are not claimed. Build verification pending.

- **2026-11-12 — Full production stage selector:** replaced the short order status list with all 18 production stages from the master prompt, including designer review, measurement, quotation/deposit, preparation, cutting, sewing, finishing, QC, fitting, alterations, collection, dispatch and delivery. Customer-request orders without a quotation now display “Awaiting quotation” instead of a misleading ₦0. Feature-branch build passed.
\n\n- **2026-11-12 — Measurement units:** customer measurement entry now accepts centimetres or inches and converts inch values to centimetres before saving, keeping historical and new records in one consistent storage unit. Feature-branch build passed on 2026-11-12; Firestore publication and live workflow verification remain pending.\n- **2026-11-12 — Feature build validation:** added a GitHub Actions workflow to build feature branches without deploying them to the live site. After removing npm cache configuration (the repository has no lockfile), run 43242216998 completed successfully on 2026-11-12.\n\n- **2026-11-12 — Customer custom-order request:** added a customer request form with garment category, item, fabric/colour preferences, quantity, measurement arrangement, preferred date request, delivery preference and instructions. Added Firestore validation for customer-owned submissions and limited owner edits; requests are unquoted and do not confirm a price or completion date. Code and rules are committed on the feature branch; Firestore rules publication and live customer submission remain unverified.\n- **2026-11-12 — Account recovery:** added a password-reset request flow to the account portal using Firebase Authentication. It requests a reset email for the supplied address and uses a non-enumerating success message for unknown accounts. Code change is committed on the feature branch; deployment and live email delivery have not yet been verified.\n\n## Implementation sequence (preserve all ten master phases)

### Phase 0 — Baseline and traceability
- Keep this register current.
- Inspect the complete current repository and Firestore rules.
- Establish a clean build baseline and record existing deployed commit.
- Preserve existing customer, product, sales, inventory, expense and role records.
- Create migration-safe schema additions; do not destructively replace existing collections.

### Phase 1 — Brand identity, homepage and public pages
- Complete company settings and public contact information.
- Build all public routes and all 20 homepage sections.
- Implement configurable public collections, product/fabric galleries, testimonials, FAQ, contact and maps.
- Implement music controls with Drive-backed asset dependency clearly documented.
- Preserve uploaded logos/company photos; do not replace them with stock imagery.

### Phase 2 — Firebase, authentication, accounts and database
- Build role model for Super Admin, Fashion Manager, Fashion Designer, Finance Officer, Institute Administrator and Instructor, retaining existing accounts/roles through explicit mapping.
- Add password recovery, profile photograph workflow and protected routes.
- Add schema/rules for students, instructors, applications, notifications, audit logs and settings.
- Test authorization at Firestore rules level, not only UI visibility.

### Phase 3 — Catalogue, customer orders and measurements
- Build category-specific fashion catalogue, product detail, favourites and reference uploads.
- Build complete custom order form, review/submit and unique reference.
- Build garment-specific measurement profiles, units, guides, validation, reuse and professional verification.
- AI measurements remain optional and estimate-only; no paid API.

### Phase 4 — Appointments, approvals and production
- Implement measurement/fitting/delivery proposals and designer scheduling.
- Add approval/rejection/alternative date/time and customer accept/decline.
- Prevent conflicts and maintain dated appointment and production histories.
- Implement all 18 order production stages, customer tracker, photos and notifications.

### Phase 5 — Quotations, manual payments, invoices and receipts
- Add pricing configuration and itemized quotation generation/acceptance.
- Add configurable bank accounts, customer payment evidence and admin verification.
- Calculate paid and outstanding balances from approved payments only.
- Keep POS sales separate from bespoke-order payments; reconcile only through explicit business rules.
- Generate downloadable invoices and receipts using free libraries.

### Phase 6 — Fashion Institute
- Course catalogue and course administration.
- Training windows, application forms, unique refs and admissions.
- Student/instructor portals, paid access, course lessons/materials, assignments/submissions, assessments, attendance, announcements, progress and certificates.
- Restrict access to admitted and payment-approved students.

### Phase 7 — Google Drive and media
- Implement a secure integration strategy compatible with zero-cost requirements.
- Separate public marketing assets from private customer uploads and restricted learning content.
- Build metadata and access controls; never expose private folders with public links.
- Require owner authorization/configuration and test actual upload/retrieval before declaring complete.

### Phase 8 — PWA and performance
- Complete offline fallback and cache strategy.
- Never show cached order/payment state as current.
- Optimize images, navigation, forms, accessibility, query cost and mobile data use.

### Phase 9 — Advanced features and analytics
- Style suggestions, fabric catalogue, loyalty, VIP, bulk/corporate requests, moderated reviews, support centre, policy/consent pages, notifications and comprehensive analytics/search.
- AI measurement only if a safe, technically credible and free solution is available.

### Phase 10 — Security, testing and delivery
- Audit Firestore rules, data validation, role permissions, private file access and data deletion.
- Test all 20 mandatory workflows with separate role accounts.
- Test responsive browsers and PWA installation.
- Deliver setup, deployment, admin, Drive, testing and free-tier guides.

## Non-negotiable completion rules
1. Do not mark a section complete because its heading, card or button exists.
2. Every sub-requirement must map to a real page/component, database structure, security rule and working workflow where applicable.
3. Never claim a third-party integration is complete without a real end-to-end test.
4. Do not use dummy data to substitute for real functionality.
5. Do not activate billing, use paid APIs or require card details.
6. Preserve existing data and working workflows; migrations must be additive and reversible where practical.
7. Distinguish code-reviewed, build-verified and live-tested statuses.
8. If a requirement cannot be implemented within the free infrastructure, document the exact limitation and implement the best safe free alternative without falsely marking the original requirement complete.
9. Final acceptance is blocked until every feasible requirement is implemented and the mandatory tests are passed or transparently recorded as blocked by an owner dependency.


- **Appointment workflow update (2026-11-12):** Added administrator alternative date/time proposals and customer acceptance. Security rules constrain who can propose and accept. Conflict prevention and calendars remain outstanding.


- **Quotation workflow update (2026-11-12):** Super Admin can prepare a price and notes for a customer order request and send the quotation. Customers can accept or decline it from My Orders. Firestore rules restrict quotation creation/changes to Super Admin and response to the owning customer. This is not yet a full deposit ledger: payment transactions remain separately recorded and balances are not automatically reconciled.

- **Appointment conflict advisory (2026-11-12):** added client-side warnings when a customer requests a time already occupied by a confirmed appointment, when Super Admin proposes an occupied time, and when a customer accepts a proposal that has become occupied. This is an advisory check against the appointments currently loaded in the client; it is not atomic or race-proof and does not satisfy guaranteed conflict prevention. A transactional reservation service or trusted backend is still required for that guarantee.

- **Production history timeline (2026-11-12):** Super Admin production-stage changes write immutable event records in the same Firestore batch as the order update. Customer and staff order views load and display dated stage history; event reads are scoped to the order owner or authorized staff, and only Super Admin can create events. The production UI, rules and styling each passed the feature-branch build workflow. Existing orders begin accumulating history only after code and rules are deployed; historical stage changes cannot be reconstructed if they were never recorded. Live Firestore authorization and end-to-end behavior remain unverified.


- **Garment-specific measurement profiles (2026-11-12):** expanded customer measurement records add profile name and garment type, with field sets for general body profile, men’s shirt, trousers, dress/gown, skirt, jacket and blouse. Customers can save multiple named profiles and reuse a prior profile as a starting point for a revised record. Inch inputs are converted to centimetres for consistent storage. Admin records display the extended measurements. Firestore create rules allow the added fields while retaining the existing collection and records. Visual tape-measure diagrams, range/anomaly checks, designer verification and live Firestore testing are still outstanding; this work is on the development branch and has not been deployed.


- **Measurement designer review (2026-11-12):** the customer measurement records panel is available to Super Admin, manager and tailor roles. Authorized staff can mark a profile awaiting review, verified or revision needed, and save a review note. Firestore rules restrict staff updates to verification metadata and retain customer ownership; live rules publication and role-based end-to-end tests remain pending.


- **Illustrated measurement guidance (2026-11-12):** added a responsive front-view schematic identifying chest, waist and hip tape positions, with practical measurement instructions and a clear designer-confirmation disclaimer. This is a general guide only; profile-specific diagrams and out-of-range/anomaly checks remain future work.

- **Measurement plausibility checks (2026-11-12):** customer measurement entry now displays non-blocking warnings for unusually small or large entered values using broad field-type ranges after conversion to centimetres. The checks are deliberately advisory rather than body-size rules; customers can continue and a designer must confirm measurements. They do not replace garment-specific fitting expertise or live Firestore testing.

- **Measurement appointment handoff (2026-11-12):** customer measurement profile form now offers a direct in-person verification request shortcut. It preselects Measurement appointment, includes the selected garment/profile context in the purpose and scrolls to the existing appointment form. Customer still selects date/time and submits; staff confirmation and existing advisory conflict checks remain unchanged. This is not an automatic booking or guaranteed slot reservation.

- **Customer production progress indicator (2026-11-12):** the My Orders view now calculates the customer's current position across the 18 configured production stages and displays a percentage progress bar plus stage count. It is based on the current recorded stage, not an estimate of time or percentage of physical work completed.

- **Industrial and corporate tailoring section (2026-11-12):** public homepage now presents corporate uniforms, group/bulk order enquiries and production coordination with WhatsApp enquiry links. It invites discussion rather than promising unverified capacity, pricing or delivery timelines.


- **2026-11-12 — Public ordering guide and FAQ:** added a five-step explanation of the bespoke order journey and six public FAQs covering custom requests, quotation/date confirmation, measurement/fitting appointments, in-person visits, corporate/group orders and institute enquiries. Wording deliberately distinguishes an enquiry from an accepted quotation and confirmed production schedule.
- **2026-11-12 — Public contact completeness:** added the supplied full business address, email address, telephone number and Monday–Saturday 9:00 AM–6:00 PM WAT opening hours to the public contact section. Company settings and editable bank details remain outstanding.


- **2026-11-12 — Customer bank-transfer declaration and review:** added a customer-owned payment declaration workflow with order, amount, transfer date, transaction reference, payer name and optional note. Declarations remain pending until Super Admin independently checks the bank account and verifies or rejects them. Verification creates a payment ledger entry and updates the order's payment status; rejection can include a customer-visible note. No bank statement, screenshot, card data, PIN, OTP or other evidence file is stored. Added Firestore rules for customer-owned creation/read and Super Admin-only review. The updated rules must be published in Firebase before this feature can be used. End-to-end live verification and balance reconciliation under concurrent approvals remain to be tested.
\n- **2026-11-12 — Institute paid-access lessons:** added administrator lesson publishing (text/video/reading resource, module, sequence and HTTPS links), manual training-payment verification for admitted applicants, student enrollment records, and student lesson access gated by an enrollment record marked paid. Firestore rules restrict lesson reads to the enrolled student or authorized Institute administration. Payment verification is a manual administrative declaration, not bank reconciliation; the operator must independently confirm funds. No video hosting or secure private Drive integration is claimed; external links are not protected from forwarding. Build verification and Firebase publication of the new rules remain pending.\n- **2026-11-12 — Fashion Institute foundation:** added configurable course creation/catalogue, training intake windows with application dates, commencement, mode, fee, venue, timetable, instructor field and capacity, customer applications with unique references, customer application status view, and Institute/Manager/Super Admin admission decisions including student ID allocation. Added collection-specific Firestore rules. This is a first Institute foundation, not the full LMS; no student/instructor portals, payment gating, learning materials, assignments, attendance, assessments or certificates are claimed. The updated `firestore.rules` must be republished in Firebase before this new module can be used. Build and live workflow verification pending.\n

- **2026-11-12 — Fashion Institute lesson progress tracking:** paid students can mark each published lesson as completed; progress records are stored per student and lesson, and students can review completion state on their course lessons. Authorized Institute administration can view completion counts and percentages per enrolled student/course. Completion is a learner self-attestation, not proof of time spent, mastery or instructor verification. Added owner-scoped `instituteLessonProgress` rules requiring paid course access. Build/deployment and live rules authorization tests pending; publish the latest `firestore.rules` in Firebase.


- **2026-11-12 — Fashion Institute certificate issuance:** added an administrator workflow to issue a uniquely referenced course-completion certificate only to a student with a paid enrollment record. Students can view their issued certificates and status in their Institute workspace. Issuance remains a manual staff decision; the interface explicitly requires staff to confirm completion and assessments before issuing. Added owner-scoped certificate reads and Institute/Manager/Super Admin create permissions in Firestore; only Super Admin can revoke or delete. The latest `firestore.rules` must be published in Firebase before the feature can be used. Build/deployment and live authorization verification remain pending.


- **2026-11-12 — Fashion Institute announcements:** added a staff publishing workflow for all-student or course-specific announcements, with optional expiry dates. Paid students see announcements for their enrolled courses and general Institute notices; course-specific reads are guarded by paid-enrollment checks in Firestore rules. Institute/Manager/Super Admin can publish and manage announcements; only Super Admin can delete. Publish the latest `firestore.rules` in Firebase before enabling this feature. Build and live authorization verification remain pending.


- **2026-11-12 — Instructor assignment foundation:** added a course-level instructor assignment record keyed by instructor UID and course ID. Institute/Manager/Super Admin can assign a course by entering the instructor's Firebase UID; Firestore validates that the target account's role is `instructor`, validates the course and deterministic assignment ID, and restricts assignment reads to the assigned instructor or authorized Institute administration. Instructor accounts now see a separate assigned-courses panel instead of student application and enrolment controls. This is the first access-control foundation only: instructor lesson publishing, assignment grading, attendance, student lists and course-scoped operational permissions are not yet implemented. Publish the latest Firestore rules before use; build and live authorization checks remain pending.
