# Firebase setup — MR FOP FASHIONS

This guide configures the production Firebase project used by the GitHub Pages website. Keep the project on the **Firebase Spark (free) plan**. Do not add billing or upgrade the project.

## 1. Create or select the Firebase project

1. Open the Firebase Console and select the project intended for MR FOP FASHIONS.
2. Register a Web app in Project settings if one does not already exist.
3. Copy the Web app configuration values. The frontend needs the API key, Auth domain, Project ID, Messaging Sender ID and App ID.
4. Keep the project ID consistent across the website, Firestore rules and any optional Apps Script integration.

The Firebase Web API key is a public project identifier, not an administrator password. Never place service-account JSON, private keys or OAuth client secrets in frontend code.

## 2. Enable Authentication

1. Open **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Do not enable paid SMS phone verification.
4. Under **Authentication → Settings → Authorized domains**, add `scholar94.github.io`.
5. Add any custom production domain only if the company actually configures one.

Customers register through the website. The app creates their customer profile and uses Firebase Authentication for password reset, sign-in and sign-out.

## 3. Create Firestore

1. Open **Firestore Database** and create the production database.
2. Select a suitable location carefully; Firestore's database location cannot be changed later.
3. Deploy the repository's `firestore.rules` before allowing real customer activity.
4. The repository's `firebase.json` points Firebase CLI to `firestore.rules` and configures the Firestore Emulator on port 8080.

To publish rules from a trusted local terminal:

```bash
npm install
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

Select the correct production project when prompted. Do not deploy test rules or disable security rules to make a feature work.

## 4. Configure GitHub Actions Firebase values

In the GitHub repository, open **Settings → Secrets and variables → Actions** and create these repository Secrets (or equivalent protected environment Secrets):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The deployment workflow reads these values during the Vite production build. Do not paste the values into chat, source code, screenshots or public issues.

Optional build-time Google Drive defaults are:

- `VITE_GOOGLE_DRIVE_CLIENT_ID`
- `VITE_GOOGLE_DRIVE_FOLDER_ID`

Google Drive can also be configured at runtime from the Super Admin account workspace; see `google-drive/README.md`.

## 5. Bootstrap the first Super Admin

The application uses the Firestore `roles/{uid}` document to determine staff access. It does not use a hardcoded administrator password.

1. Open the deployed website and register the intended owner account.
2. Verify the email address and sign in once so the customer profile is created.
3. In Firebase Console → Authentication → Users, copy that account's UID.
4. In Firestore Console, create the document `roles/{UID}` with this field:

   `role: "superAdmin"`

5. Sign out of the website and sign in again so the role document is loaded.
6. Confirm the Super Admin workspace and audit viewer are visible.

This first role document must be created by the Firebase project owner in the trusted Firebase Console. The Firestore rules intentionally prevent an ordinary customer from granting themselves a staff or Super Admin role. Never create a public bootstrap endpoint or expose service-account credentials.

For additional staff, first have each person register and verify their own account. A Super Admin can then assign one of the supported roles from the staff permissions section: `manager`, `sales`, `tailor`, `finance`, `institute` or `instructor`.

## 6. Verify the setup

- Confirm Email/Password sign-in and password reset work.
- Confirm the owner account has the correct `roles/{uid}` document.
- Confirm the production Firestore rules are published.
- Confirm a customer cannot read another customer's records.
- Confirm staff only see records permitted for their role.
- Run the repository CI workflow; it compiles the app, runs browser smoke tests and tests the rules against synthetic accounts in the Firestore Emulator.

A passing Emulator test does not prove that the production Firebase project has the same rules or configuration. Verify the live project separately before accepting real orders or payments.
