# Google Drive media integration — MR FOP FASHIONS

This repository uses the Google Drive API for customer reference designs, production media and Fashion Institute lesson files. Drive is a separate service: Firebase authentication does not automatically grant Drive access.

## One-time Google Cloud setup

1. Open Google Cloud Console and select or create a project.
2. Enable **Google Drive API** for that project.
3. Configure the OAuth consent screen. Add the staff Google accounts that will upload media as test users while the app remains in testing mode. Complete Google's verification requirements before broad external distribution if the consent screen requests it.
4. Create an OAuth client ID of type **Web application**.
5. Add the exact deployed website origin (scheme + hostname only, without a path) under **Authorized JavaScript origins**. Also add the local development origin if needed.
6. Copy the OAuth client ID. Do not put a client secret in the website.
7. In Google Drive, create a normal My Drive folder for MR FOP FASHIONS media. Give each authorized uploader Editor access and copy the folder ID from its URL.
8. In GitHub repository **Settings → Secrets and variables → Actions → Variables**, set:
   - `VITE_GOOGLE_DRIVE_CLIENT_ID` — the OAuth Web client ID.
   - `VITE_GOOGLE_DRIVE_FOLDER_ID` — the shared root folder ID.
9. Trigger a deployment from the `main` branch so the Vite build receives the variables.

## Upload and access behaviour

- Staff production photos/videos are uploaded into the configured shared folder under `Production/<order-id>`.
- Customer reference designs are uploaded by the customer into that customer's Drive, then shared with the MR FOP FASHIONS contact account configured in the portal.
- Fashion Institute lesson files are uploaded under `Institute/Courses/<course-id>/Lessons`.
- Institute lesson uploads are shared as Drive reader permissions with email addresses on current paid enrolments. When a new student's payment is verified, the app attempts to grant that student reader access to existing lesson files for that course.
- Lesson links are not intentionally made public. A student's Google account must match the email address to which the Drive file was shared.
- If a Drive share operation fails after the Institute payment transaction succeeds, the student's paid enrolment remains active and the portal displays a separate warning that media access needs attention.

## Important security and operating limits

- The staff member performing an upload or new-student media grant must sign in to Google and have permission to upload/share in the configured Drive folder.
- The app requests Drive OAuth access at the time a staff member performs a Drive action. Browser popup restrictions, OAuth consent configuration, account policy and Drive quotas can prevent the operation.
- Drive permissions are access controls, not DRM. They do not guarantee prevention of screen recording, screenshots, copying with external tools or redistribution by an authorized viewer.
- Access revocation when a student is refunded, withdrawn or loses paid status is not yet automated. Review and revoke Drive permissions manually until a controlled revocation workflow is implemented.
- Existing links from external providers remain external links; this integration does not migrate them into Drive.
- Do not make customer measurements, payment evidence or other private records public.
- Do not add OAuth client secrets, service-account keys or Firebase credentials to source code.

## Verification checklist

1. Confirm the website build includes both Drive GitHub Actions variables.
2. Sign in with an authorized staff account and upload a small PDF lesson to a test course.
3. Confirm the file appears in the expected Drive folder and is not set to public/anyone access.
4. Confirm the test paid student's Google account has Reader permission.
5. Sign in as that student and open the lesson resource.
6. Verify a non-enrolled account cannot access the Drive file.
7. Verify a newly paid test student receives access when the payment verification action is run.
8. Check the browser console and Drive permissions if any step fails.
