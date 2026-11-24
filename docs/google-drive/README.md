# Google Drive media integration — MR FOP FASHIONS

This repository uses the Google Drive API for customer reference designs, production media and Fashion Institute lesson files. Drive is a separate service: Firebase authentication does not automatically grant Drive access.

## One-time company upload setup

The website sends uploads to an owner-operated Google Apps Script broker in the background. Customers and staff select files directly on MR FOP; they do not sign in to Google, open Drive, or leave the website during upload.

1. Sign in to the Google account that owns the company's Drive folder and create a private root folder for MR FOP FASHIONS.
2. Open https://script.google.com/home and create a project. Replace its code with `google-apps-script/PaymentEvidenceUpload.gs` from this repository.
3. In Script Properties, set `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, and `DRIVE_FOLDER_ID`.
4. Deploy as a Web App with **Execute as: Me** and **Who has access: Anyone**. Authorise Drive and external-request access as the company owner.
5. Save the deployed `/exec` URL as the GitHub Actions repository variable `VITE_GOOGLE_DRIVE_UPLOAD_URL`, then run a new website deployment.

The script verifies Firebase ID tokens and reads the caller's Firestore role before creating files. It uses the company account's Drive access; no Drive OAuth client ID is needed for file uploads.

## Upload and access behaviour

- Staff production photos/videos are uploaded into the configured shared folder under `Production/<order-id>`.
- Customer reference designs are uploaded into the company Drive under a UID-specific folder and shared with the MR FOP FASHIONS contact account.
- Fashion Institute lesson files are uploaded under `Institute/Courses/<course-id>/Lessons`.
- Institute lesson uploads are shared as Drive reader permissions with email addresses on current paid enrolments. When a new student's payment is verified, the app attempts to grant that student reader access to existing lesson files for that course.
- Lesson links are not intentionally made public. A student's Google account must match the email address to which the Drive file was shared.
- If a Drive share operation fails after the Institute payment transaction succeeds, the student's paid enrolment remains active and the portal displays a separate warning that media access needs attention.

## Important security and operating limits

- File uploads use the company-owned Apps Script broker. Customers and staff authenticate only with their MR FOP account; they do not need Google Drive access, a Google account or a Google sign-in popup to upload.
- The company owner authorizes the broker once when deploying it as **Execute as: Me**. Separate administrative permission actions (publishing/unpublishing media and granting/revoking lesson access) still use the Drive API and may require an authorized Google Drive session.
- Drive permissions are access controls, not DRM. They do not guarantee prevention of screen recording, screenshots, copying with external tools or redistribution by an authorized viewer.
- On an Institute withdrawal, the application first disables Firestore course access and releases the intake place, then attempts to remove the student's direct Drive permissions from lesson files for that course (including unpublished lesson records). This is a best-effort external operation: if Drive authorization or the API fails, use the Super Admin revoke control to retry. Inherited permissions cannot be removed at the child file and require review of the parent folder or shared-drive permissions. Refunds and other payment reversals do not automatically withdraw a learner; Finance/Institute staff must follow the approved access decision and verify Drive permissions.
- Existing links from external providers remain external links; this integration does not migrate them into Drive.
- Do not make customer measurements, payment evidence or other private records public.
- Do not add OAuth client secrets, service-account keys or Firebase credentials to source code.

## Verification checklist

1. Confirm the Apps Script broker is deployed as **Execute as: Me** / **Anyone**, its Script Properties contain `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY` and `DRIVE_FOLDER_ID`, and the GitHub Actions variable `VITE_GOOGLE_DRIVE_UPLOAD_URL` contains the deployed `/exec` URL.
2. Sign in to MR FOP with a test account and upload a small PDF lesson to a test course. Confirm the upload completes in the background without a Google sign-in popup or leaving the website.
3. Confirm the file appears in the expected Drive folder and is not set to public/anyone access.
4. Confirm the test paid student's Google account has Reader permission.
5. Sign in as that student and open the lesson resource.
6. Verify a non-enrolled account cannot access the Drive file.
7. Verify a newly paid test student receives access when the payment verification action is run.
8. Check the browser console, Apps Script Executions, Script Properties, the configured upload URL and Drive permissions if any step fails.


## Super Admin lesson-access recovery controls

The Institute student learning progress register provides two Super Admin-only actions for each enrolment:

- **Retry / grant Drive lesson access** checks the enrolment is marked paid and active, then grants or confirms Reader access to lesson files with Drive file IDs for that course.
- **Revoke direct Drive lesson access** asks for confirmation, then removes direct user permissions for that student's email from lesson files with Drive file IDs for that course, including unpublished lesson records. It does not alter the payment or enrolment record. Inherited permissions are reported and cannot be removed from the child file.

Use revocation after an independently confirmed access decision. Withdrawal triggers a best-effort revocation attempt; if it fails, retry it from the Super Admin control. Refunds/payment reversals do not themselves revoke course access or change enrolment status. Recheck the student's enrolment and Drive permissions after every access change. A fresh Google Drive authorization may be required.

