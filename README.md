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
6. The Super Admin can assign staff roles to users who have already registered: manager, sales, tailor, or institute.

The initial role document must be created by the project owner in Firebase Console. The deployed Firestore rules prevent ordinary users from granting themselves roles or changing their own role. Super Admin cannot change their own role through the staff interface.

## Security model
- Passwords are managed by Firebase Authentication and are not stored in Firestore.
- Customer profiles are owner-readable; staff access is role-limited.
- Role documents are self-readable; only the Super Admin can assign roles to other users.
- Orders, measurements and training enquiries have separate access rules.
- Review and test the rules in Firebase Emulator before production data is added.

## Branding assets
The three supplied logo images have been identified for these uses:
1. App icon / PWA identity.
2. Main MR FOP FASHIONS logo.
3. MR FOP Vocational Institute logo.

They still need to be added to `public/brand/` and wired into the website's manifest and page components. Do not redraw or substitute these approved logos.

## Phase scope
Phase 1: public brand website and Pages deployment.
Phase 2 foundation: Firebase-ready customer registration/sign-in, profile creation, role-aware account portal, Super Admin staff assignment interface and Firestore security rules.

Firebase must be configured and its rules deployed before account registration or sign-in can work. Customer orders, measurement records, payments, training enrolment, Google Drive document and media uploads are integrated through the Drive API.

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
