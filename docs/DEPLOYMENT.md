# Deployment guide

## Production website

The application is deployed to GitHub Pages:

- Repository: `Scholar94/mrfob`
- Production site: `https://scholar94.github.io/mrfob/`
- Production branch: `main`

## GitHub Pages configuration

1. Open repository **Settings → Pages**.
2. Set the build/deployment source to **GitHub Actions**.
3. Keep the deployment workflow at `.github/workflows/deploy.yml`.
4. Configure the Firebase Web app values listed in `FIREBASE-SETUP.md` as protected GitHub Actions Secrets.
5. The build job uses the `github-pages` environment so environment-scoped values are available. A preflight step now fails the release if any required Firebase Web configuration secret is missing; it never silently deploys a non-functional offline-only account shell.
6. Push a reviewed commit to `main`. The workflow builds the production bundle, runs Chromium browser smoke tests, runs platform source guardrails, runs the Firestore Emulator suite, uploads the Pages artifact and deploys it.
7. Confirm the latest workflow run has a successful build and deploy job before announcing a release.

Do not manually upload a stale build artifact over the Actions deployment.

## GitHub Pages deep links

The app uses the `/mrfob/` base path. Keep these values aligned:

- `vite.config.js` base path.
- `public/404.html` SPA fallback.
- `public/manifest.webmanifest` start URL and scope.
- `public/sw.js` cache paths.
- `public/sitemap.xml` canonical URLs.

The Chromium CI smoke test verifies the public routes, account entry routes, canonical metadata, PWA manifest, service-worker scope and cached offline fallback.

## Firestore rules

GitHub Actions runs Firestore rules tests against the Emulator. It does not automatically publish rules to the production Firebase project. Publish the reviewed rules separately using the procedure in `FIREBASE-SETUP.md`, then verify the live project ID and rules publication timestamp.

## Google Drive and Institute grading

- Configure Google Drive API and OAuth Web Client in Google Cloud Console.
- Add `https://scholar94.github.io` as an authorized JavaScript origin.
- Configure the shared company folder and staff permissions.
- Sign in as Super Admin and save the OAuth Web Client ID and shared folder ID in **Google Drive Integration** settings.
- Do not enter a Google client secret in the website. The OAuth Web Client ID and folder ID are identifiers, not passwords.
- Optional GitHub Actions environment values can override the runtime Drive settings.
- Follow `google-drive/README.md` and `google-apps-script/README.md` for file access, lesson permission revocation and optional objective grading.

## Release verification

After deployment:

1. Open the production homepage and refresh it.
2. Open the public deep links and legal pages.
3. Open Register and Login.
4. Sign in separately with customer, manager, designer/tailor, finance, Institute Admin, instructor and Super Admin test accounts.
5. Verify customer data isolation and role-specific workspace access.
6. Run one controlled customer order, appointment, quotation, payment-evidence review and production update.
7. Run one controlled Institute application, admission, payment, lesson access and withdrawal workflow.
8. Verify Drive upload and permission revocation using test files and test accounts.
9. Test the PWA on supported Android/iOS/desktop devices, including actual installation and offline behaviour.
10. Record results in `QA-TEST-PLAN.md`.

Never use real bank transfers, real customer photographs or sensitive production records as test data.
