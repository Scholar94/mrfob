# MR FOP FASHIONS — Website and Customer Platform

Public website and customer account foundation for **MR FOP FASHIONS COMPANY NIGERIA LIMITED**, established 2010.

## Current stack
- React 18 + Vite
- GitHub Pages hosting and GitHub Actions deployment
- Firebase Authentication (email/password)
- Cloud Firestore with role-based Security Rules
- Google Drive direct upload integration for shared file storage

## Local development
```bash
npm install
npm run dev
```

## GitHub Pages deployment
The Vite base path is configured for `https://scholar94.github.io/mrfob/`.
Repository Settings → Pages → Source must be **GitHub Actions**.

## Firebase connection
Create a Firebase project, register a Web app, enable Authentication → Email/Password, and create a Cloud Firestore database. Add these GitHub Actions repository secrets (Settings → Secrets and variables → Actions):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Use the values from Firebase Project settings → Your apps → SDK setup and configuration. These web configuration values are included in the public browser bundle by design; secure the project with Firebase Authentication, authorized domains and Firestore Security Rules. Never put service-account private keys in the frontend or GitHub repository.

Add `scholar94.github.io` to Firebase Authentication → Settings → Authorized domains.

## Deploy Firestore Security Rules
Install Firebase CLI locally, sign in, select the correct Firebase project, then run:
```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

## First Super Admin setup
1. Register the owner's email through the website's **My Account** portal after Firebase has been connected.
2. In Firebase Console → Firestore Database → Data, create a collection named `roles`.
3. Create a document whose document ID is the owner's Firebase Authentication UID.
4. Add fields: `uid` (string, same UID), `email` (string, owner's email), `role` (string, exactly `superAdmin`).
5. Sign out and sign in again. The account portal will then identify the Super Admin.
6. The Super Admin can assign staff roles to users who have already registered: manager, sales, tailor, institute, instructor, or finance. A Tailor sees only clothing orders explicitly assigned to that Tailor; the Super Admin assigns the designer in the Order Management card.

The initial role document must be created by the project owner in Firebase Console. The deployed Firestore rules prevent ordinary users from granting themselves roles or changing their own role. Super Admin cannot change their own role through the staff interface.

## Security model
- Passwords are managed by Firebase Authentication and are not stored in Firestore.
- Customer profiles are owner-readable; staff access is role-limited.
- Role documents are self-readable; only the Super Admin can assign roles to other users.
- Orders, measurements and training enquiries have separate access rules.
- Customer payment declarations and payment ledger records are readable only by the owning customer, Finance Officer and Super Admin.
- Tailor access to order records, event history, reference designs and production media is restricted to orders assigned to that Tailor.
- Review and test the rules in Firebase Emulator before production data is added. Deploy updated rules with `firebase deploy --only firestore:rules` before relying on the new permission boundaries.

## Configurable public company profile

The Super Admin account includes a Public Company Profile form for the public-facing company name, telephone, WhatsApp, email, address, opening hours, mission, vision and business scope. The homepage reads the public `publicSettings/siteProfile` document and uses the saved values for its company story, contact details, directions and contact links. If the document is not yet configured, the site falls back to the current company details already in the source.

Only the `siteProfile` document is anonymously readable. Firestore rules restrict its writes to Super Admin and validate field names and lengths. Customer bank-transfer instructions remain in the separate `paymentInstructions` document and are not included in the public profile. Publish the latest Firestore rules before using the settings form.

## Customer saved designs and verified reviews

- Signed-in customers can save or remove catalogue products in their own `customerFavourites/{uid}/items/{productId}` subcollection. Firestore rules prevent one customer from reading or changing another customer's saved designs.
- A customer can submit one 1–5-star review with a 10–1,000-character comment only for an order whose production status is `delivered`. The review document ID is the order ID, preventing duplicate reviews for that order.
- New reviews remain private in `pending` moderation status. Super Admin and Fashion Manager can approve or reject them in the account portal. Only approved reviews are publicly readable and shown on the homepage; the public view displays the first name, rating and comment.
- Publish the current `firestore.rules` before enabling these features. Test customer ownership, delivered-order eligibility, duplicate prevention, manager moderation and anonymous public access in the Firebase Emulator and with separate live accounts.

## Approved branding assets
The three supplied and approved logo images are committed under `public/` and wired into the live application:
1. `mr-fop-website-logo.webp` — public website header and footer.
2. `mr-fop-app-logo.webp` — browser favicon, Apple touch icon and PWA manifest icon.
3. `mr-fop-fashion-institute-logo.webp` — public Fashion Institute section and Institute workspace.

The integration was deployed successfully in commit `6deadba8b59dd90baa7bb7298c9f1a61c57b33f7`. Do not redraw or substitute these approved logos.

## Phase scope
Phase 1: public brand website and Pages deployment.
Phase 2 foundation: Firebase-ready customer registration/sign-in, profile creation, role-aware account portal, Super Admin staff assignment interface and Firestore security rules.

Firebase must be configured and its rules deployed before account registration or sign-in can work. Customer orders, measurement records, payments, training enrolment, Google Drive document and media uploads are implemented through the Drive API, subject to the owner completing the OAuth client, shared-folder and GitHub Actions variable setup described below. Live upload and access workflows still require verification.

## Free-tier note
No billing account has been connected or paid service enabled by this code. Firebase Authentication and Firestore have no-cost usage allowances; monitor quotas in Firebase Console. GitHub Pages remains the free public hosting option.


## Production progress photos and videos
- Authorized Super Admin, Manager and Tailor accounts can upload JPG, PNG, WebP, MP4, WebM and MOV files to the shared Google Drive folder.
- Images are limited to 20 MB and videos to 100 MB per file. Resumable Drive uploads are used for larger media.
- Each upload records the order, production stage, uploader, timestamp, caption, Drive file ID, file type and size in `orders/{orderId}/progressUpdates`.
- Customers receive an in-app notification when a production media update is published. Private Drive files must be shared with the customer's Google account for access.
- Firebase Storage is not used. Firestore stores metadata and Drive references only.

## Google Drive file storage setup
1. In Google Cloud Console, enable the Google Drive API for the project used by the app's OAuth client. Enabling this API does not require billing.
2. Configure the OAuth consent screen and add the staff Google accounts as test users while the app remains in testing mode.
3. Create an OAuth 2.0 Web application client ID. Add `https://scholar94.github.io` as an authorized JavaScript origin.
4. Create a shared folder in the owner's Google Drive for MR FOP FASHIONS uploads. Share it with staff Google accounts as Editors.
5. Add these GitHub Actions repository **Variables** (Settings → Secrets and variables → Actions → Variables):
   - `VITE_GOOGLE_DRIVE_CLIENT_ID` — OAuth web client ID.
   - `VITE_GOOGLE_DRIVE_FOLDER_ID` — ID of the shared Drive folder.
6. Redeploy the GitHub Pages site. On first upload, staff authorize Google Drive access. Files are uploaded directly to the shared folder.

All uploaders must sign in with a Google account that has Editor access to the shared folder. Customer viewing of private media requires sharing the individual file with the customer's Google account. Google Drive storage quotas and file-size limits apply; no paid Google Cloud billing is required for this Drive API integration.


## Public website media publishing
- Only Super Admin and Manager (the existing Admin-equivalent staff role) can upload, publish, unpublish or remove public website media.
- The media manager is available inside the account portal. It uploads images and videos directly to the configured Google Drive folder.
- New website media is saved as a private draft. Publishing grants Google Drive `anyone: reader` access to that individual file and exposes its metadata in the public `siteMedia` collection. Unpublishing revokes that public Drive permission.
- Public visitors can view published media without creating an account or supplying an email address.
- Customer-specific garment production photos and videos remain in the order's private progress updates. They are not made public by the website media publisher.
- Firestore rules permit anonymous reads only for documents marked both `published: true` and `visibility: 'public'`; media publishing mutations are limited to Super Admin and Manager.
- Website media supports JPG, PNG, WebP, MP4, WebM and MOV. Image limit: 20 MB. Video limit: 100 MB.
- The Public Website Media manager also accepts the official company theme song as MP3, M4A, WAV or OGG audio (maximum 50 MB). Upload it with the **Company theme song** category, then publish it. The homepage brand-music player reads the latest published track and waits for the visitor to press Play; it never starts audio automatically.


## Objective assessment auto-marking

The Fashion Institute supports objective multiple-choice assessments with server-side automatic marking through the free Google Apps Script option. See [docs/google-apps-script/README.md](docs/google-apps-script/README.md) for setup, permissions and deployment. Add the GitHub Actions variable `VITE_ASSESSMENT_GRADING_URL` with the deployed Apps Script `/exec` URL, then redeploy the site. Correct answers are stored in a separate staff-only Firestore collection; the browser never receives the answer key.


## Integrations and setup

- [Google Drive media integration setup and access controls](docs/google-drive/README.md)
- [Secure Fashion Institute objective assessment grader](docs/google-apps-script/README.md)
- [24-section master prompt traceability register](docs/MASTER-PROMPT-TRACEABILITY.md)


## Staff role boundaries

- **Super Admin:** assigns staff roles, assigns a Tailor to each production order, manages company settings and retains full administrative access.
- **Fashion Manager / Sales:** manage the clothing orders and customer-service workflows allowed by Firestore rules.
- **Tailor:** sees only orders assigned to their own UID and can update production stages or upload progress media for those assigned orders.
- **Finance Officer:** reviews customer bank-transfer declarations, verifies or rejects them, views the payment ledger/sales/expenses, and records expenses. The role does not receive the general clothing-order administration or staff-role controls.
- **Institute Administrator / Instructor:** work within their respective course, student and learning workflows; Institute staff do not receive the clothing-order or Finance workspace.

These are source-level permissions. The latest `firestore.rules` must be published to Firebase, and the boundaries must be tested with separate role accounts before production use.


## Customer privacy requests

The account portal includes a private privacy-request centre. Customers can submit requests to access, correct or delete personal information; they can see the request status and the company's recorded response. Only the Super Admin can review all requests or change their status. Submitting a deletion request does not automatically erase records: staff must review account records, legal/accounting retention needs and related Google Drive files before confirming completion. Customer data export is also available from My Profile. Publish the latest `firestore.rules` before using this feature.


## Fabric gallery

The public homepage includes a live fabric gallery backed by the Firestore `fabrics` collection. Super Admins can add, edit and archive fabrics with a name, colour, texture, indicative price range, availability, suitable garment categories and optional HTTPS image URL. Only active fabric records are publicly readable; writes are restricted to Super Admin by Firestore rules. The catalogue does not claim live physical stock counts or guaranteed prices.


## Customer loyalty and VIP benefits

The account portal now includes a customer-benefits panel. Super Admin can set a customer tier (Standard, Silver, Gold or VIP), an approved discount percentage (0–50%), priority-support access and manual loyalty-point adjustments. Point changes are written to an append-only `loyaltyTransactions` history so customers can see the recorded reason and points movement. Customers can read only their own benefits and points history. Automatic purchase-based or referral-based point accrual is not enabled; points are currently managed manually. Publish the latest Firestore rules before use.


## Private payment evidence

Customer bank-transfer declarations require a JPG, PNG, WebP or PDF payment receipt (maximum 15 MB). The browser uploads the file directly to Google Drive using the customer's Drive authorization and shares it with the company account `mrfopvi@gmail.com`. Firestore stores only the private Drive file ID, metadata and view link. The evidence is visible in the customer declaration history and to authorized Finance Officer/Super Admin reviewers. A receipt upload never marks a payment as paid; Finance must independently verify the bank transaction and approve the declaration. Staff Google Drive access and the current Firestore rules must be configured before use.


## Customer referral programme

Customers receive a shareable referral code and can submit a referral with the prospective customer's name and contact details. Customers see only their own referral submissions; the Super Admin can review all referrals and update status/notes. Referral status changes do not automatically award loyalty points. The Super Admin must verify the referred customer's eligibility and separately record any approved points in Customer loyalty and VIP benefits. Customers should only submit contact details they are authorised to share. Publish the latest Firestore rules before enabling the feature.


## Corporate and bulk-order enquiries

Customers can submit private enquiries for corporate uniforms, school uniforms, church/ministry outfits, wedding parties, events and other institutional orders. The form captures organisation, contact, quantity, preferred (unconfirmed) completion date, location and requirements. Customers can see their own request and the response; Super Admin and Fashion Manager can review all requests and update status/notes. This is a request-for-quotation workflow, not an automatic quote or a guaranteed production commitment.


## Automated source verification

The GitHub Pages deployment workflow runs `npm run verify:platform` after the production build. These checks guard required source files, public/account route entry, GitHub Pages fallback, PWA metadata, Drive integration, Firestore deny-by-default and the no-Storage/no-Functions constraints. These are static regression checks, not substitutes for Firebase Emulator tests or live end-to-end testing with separate user roles.


## Privileged action audit trail

A Super Admin-only audit viewer lists up to 150 of the latest application audit events. The append-only Firestore `auditLogs` collection records selected privileged actions, including payment declaration review, staff role assignment, public and payment settings, designer availability, appointment status/assignment, order designer assignment and production/delivery updates, inventory adjustments, privacy-request handling, referral review, fabric changes, corporate enquiry updates, loyalty benefit changes, Institute admission/payment decisions and Drive lesson permission changes. Staff can append only records attributed to their own authenticated UID; only the Super Admin can read the collection; clients cannot update or delete audit entries. This is an application-level log for instrumented actions, not a tamper-proof external ledger and not a complete log of every system event.


## Public FAQ management

The homepage uses its built-in FAQ list as a fallback. Super Admin and Fashion Manager can add, edit, reorder and archive dynamic FAQs in the account portal. Active questions are publicly readable; inactive records are restricted to managers and Super Admin. FAQ records are retained when archived, and selected FAQ changes are included in the audit trail.


## Final acceptance testing

A 22-case role-based acceptance test plan is maintained in docs/QA-TEST-PLAN.md. It is intentionally marked not run until the owner has configured the production Firebase project, published current Firestore rules, configured Drive/Apps Script and prepared separate test accounts. Passing the GitHub Actions build and static source checks does not count as passing the acceptance plan.


## Product gallery and customisation

The Super Admin product form supports a primary image plus up to eight additional HTTPS image views, available colours, fabric options and customisation options. Customer product cards let users switch between the saved image views and review the listed options. Existing product records can continue to receive stock adjustments even if they predate the optional gallery arrays. Product catalogue fields are protected by Firestore rules. The portal catalogue is not yet a complete public e-commerce checkout or live inventory reservation system.

## Refund requests and manual refund recording

Customers can submit one refund request per verified payment. Finance Officers and Super Admins can review, approve or reject a request. A refund can only be marked paid after it has been approved and a real transfer reference has been entered. This is a record of a manually completed bank transfer; the platform does not initiate or verify bank transfers. Refunds are not automatically netted from POS or statutory financial reports. Publish the latest Firestore rules before use.


## Firestore security regression tests

The GitHub Actions deployment workflow starts the local Firestore Emulator and runs `scripts/verify-firestore-rules.mjs`. The focused tests cover customer-owned privacy requests, the one-refund-per-payment lifecycle and Finance review, referral ownership, public/archived fabric visibility, product gallery writes and the deny-by-default rule. The emulator test suite does not yet cover every collection or every role combination. It does not publish rules to the production Firebase project.


## Institute learner withdrawal

Institute Administrators, Managers and the Super Admin can withdraw an admitted learner with verified paid enrolment. The action atomically updates the enrolment and application status and releases one place in the intake. Firestore lesson access is denied for withdrawn enrolments even though the historical payment record remains paid. The app then attempts to revoke direct Google Drive lesson permissions; inherited permissions may remain and Drive failures must be retried manually. Withdrawal is not a refund. Refunds are handled separately.
