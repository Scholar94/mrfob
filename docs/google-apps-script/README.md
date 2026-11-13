# Secure objective assessment grading (free Google Apps Script option)

This service automatically grades multiple-choice Fashion Institute assessments without putting correct answers in the student-facing assessment document or calculating marks in the browser.

## Files
- `AssessmentGrader.gs` — Apps Script web-app endpoint.
- `appsscript.json` — required OAuth scopes.

## One-time setup

1. Open [Google Apps Script](https://script.google.com/) and create a standalone project named **MR FOP FASHIONS Assessment Grader**.
2. Replace the editor's default code with the complete contents of `AssessmentGrader.gs` from this folder.
3. Open **Project Settings**, enable **Show "appsscript.json" manifest file in editor**, then replace the manifest with this folder's `appsscript.json`.
4. In the Apps Script project, open **Project Settings → Script Properties** and add:
   - `FIREBASE_PROJECT_ID` — the exact Firebase project ID used by the website.
   - `FIREBASE_API_KEY` — the Firebase Web API key from Firebase Project settings → General → Your apps.
5. The Google account that owns the script must have permission to read and write the project's Firestore database. In Google Cloud IAM, grant that account **Cloud Datastore User** (or a more restricted custom role with document read/create permissions). Do not put a service-account key in the website or repository.
6. Deploy → **New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy and authorize the requested Google permissions.
7. Copy the Web app URL ending in `/exec`.
8. In GitHub repository **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_ASSESSMENT_GRADING_URL` — the Apps Script Web app `/exec` URL.
9. Redeploy the GitHub Pages website. The workflow injects this variable into the browser build.

## How the security works

- Students authenticate with Firebase. The browser sends the Firebase ID token and selected A/B/C/D answers to Apps Script.
- Apps Script verifies the token with Firebase Authentication, checks the paid enrolment, published objective assessment, due date, and duplicate-submission state.
- Correct options live in `instituteAssessmentAnswerKeys`, a staff-only Firestore collection. The student-facing assessment contains question text and options only.
- The script reads the key and calculates the score server-side, then creates the final immutable-to-students graded submission.
- The student cannot choose their own score or read the answer-key collection through Firestore rules.

## Important operating notes

- The web app must execute as the trusted owner account; do not deploy it as the student.
- Anyone can reach the URL, but a valid Firebase ID token and a paid enrolment are required for grading.
- Apps Script quotas and Firestore quotas apply. This design does not require Firebase Cloud Functions or a Blaze billing upgrade.
- The browser uses a no-CORS form-style request because Apps Script ContentService does not provide configurable CORS headers. It confirms completion by checking for the server-created Firestore submission.
- Written assessments continue to use the existing manual grading workflow.
- Deploy the updated Firestore rules from the repository before enabling real objective assessments.
- This endpoint creates a submission only once; retakes require a separately configured assessment instance rather than deleting a student's grade.
