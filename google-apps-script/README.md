# MR FOP FASHIONS — Company-owned payment receipt uploads

This endpoint lets signed-in MR FOP customers submit transfer evidence directly into the company's Google Drive. Customers do not need a Google account and never receive Drive access.

## 1. Create the Apps Script service

1. Sign in to the Google account that owns the company's Drive folder.
2. Open https://script.google.com/home and create a new project named **MR FOP Payment Evidence Upload**.
3. Replace the editor contents with `PaymentEvidenceUpload.gs` from this repository.
4. In **Project Settings → Script Properties**, add:
   - `FIREBASE_PROJECT_ID`: the exact Firebase project ID used by the website.
   - `DRIVE_FOLDER_ID`: the ID of the private Google Drive folder where payment receipts should be stored.
5. Run no function manually. Deploy using **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorise the script's Drive and external-request permissions when Google asks.
7. Copy the deployed Web app URL. It must end in `/exec`.

The web app must execute as the company Drive owner. Do not use "Execute as user accessing the web app".

## 2. Add the endpoint to GitHub

In https://github.com/Scholar94/mrfob/settings/variables/actions create a repository variable:

- Name: `VITE_GOOGLE_DRIVE_UPLOAD_URL`
- Value: the Apps Script Web app URL ending in `/exec`

The deployment workflow injects this URL into the website build. A new successful GitHub Pages deployment is required before the customer upload flow uses it.

## 3. Verify

1. Sign in to the live website as a customer.
2. Submit a transfer declaration with a JPG, PNG, WebP or PDF receipt (maximum 15 MB).
3. Confirm the declaration appears in the customer's payment declarations and Finance review queue.
4. Confirm the file appears in the configured private company Drive folder.

## Security notes

- The endpoint is publicly reachable so browsers can submit without Google sign-in, but it verifies the Firebase ID token against Google's token-info endpoint before writing anything.
- It checks the Firebase project audience, issuer, expiry and authenticated subject.
- Files are created in the owner's Drive folder. No customer Drive permission or customer Gmail address is required.
- Keep the Drive folder private. Finance should access it through the company's own Google account or its existing internal sharing.
- The endpoint only accepts the configured Firebase project and receipt MIME types. Do not put Google passwords, OAuth client secrets, or service-account keys in the website or GitHub repository.
