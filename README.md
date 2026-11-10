# MR FOP FASHIONS — Website and Customer Platform

Public website and customer account foundation for **MR FOP FASHIONS COMPANY NIGERIA LIMITED**, established 2010.

## Current stack
- React 18 + Vite
- GitHub Pages hosting and GitHub Actions deployment
- Firebase Authentication (email/password)
- Cloud Firestore with role-based Security Rules
- Google Drive and Apps Script integration planned for later phases

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
- `VITE_FIREBASE_STORAGE_BUCKET`
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

Firebase must be configured and its rules deployed before account registration or sign-in can work. Customer orders, measurement records, payments, training enrolment, Google Drive document handling and Apps Script automations are subsequent implementation steps.

## Free-tier note
No billing account has been connected or paid service enabled by this code. Firebase Authentication and Firestore have no-cost usage allowances; monitor quotas in Firebase Console. GitHub Pages remains the free public hosting option.
