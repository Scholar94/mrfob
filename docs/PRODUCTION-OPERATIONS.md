# Production operations, backup and recovery runbook

**Project:** MR FOP FASHIONS COMPANY NIGERIA LIMITED  
**Application:** https://scholar94.github.io/mrfob/  
**Repository:** https://github.com/Scholar94/mrfob  
**Last reviewed:** 16 November 2026

This runbook covers operational work that cannot safely be automated from the public browser application. It is deliberately conservative: do not promise that customer data is backed up, erased, restored or transferred until the owner has completed and recorded the relevant operation.

## 1. Systems and data locations

| Data / service | System of record | Operational note |
|---|---|---|
| Login credentials and verified email | Firebase Authentication | Passwords are managed by Firebase; never export or share passwords. |
| Profiles, roles, orders, measurements, appointments, payments, refunds, inventory, Institute records and audit events | Cloud Firestore | Firestore Security Rules are the access-control boundary. |
| Reference designs, production media and lesson files | Google Drive | Firestore metadata and Drive file permissions are separate; back up and review both. |
| Website source and deployment history | GitHub repository | Source control is not a backup of Firestore or Drive data. |
| Public static website | GitHub Pages | Rebuild/redeploy from the repository workflow. |

## 2. Before production use

- Confirm the Firebase project ID and ensure it is the intended production project.
- Enable Firebase Authentication Email/Password and add `scholar94.github.io` to the authorized domains.
- Publish the current repository `firestore.rules` to that project. The GitHub Pages workflow tests rules in an Emulator; it does **not** publish production rules.
- Create the initial Super Admin role only for the owner's actual Firebase Authentication UID. Never grant a role based on a display name or email supplied in an unverified message.
- Configure Google Drive OAuth origins and folder sharing. Grant access only to staff who need it.
- Keep bank-transfer instructions hidden until the registered account names and account details have been checked independently.
- Use test-only records and accounts for acceptance tests. Never use real customer data as test fixtures.

## 3. Backup policy and limitations

**No automatic production backup is currently configured by this repository.** A successful GitHub Actions deployment does not back up Firestore, Firebase Authentication or Google Drive.

The owner should select a backup method and document its actual cost before enabling it. Firestore managed export/import and scheduled backup features can require a billing-enabled Google Cloud project, Cloud Storage and incur storage, operation or network charges. Do not enable a paid plan or enter payment details merely to follow this runbook.

Minimum practical safeguards:

1. Keep the GitHub repository under version control and retain successful deployment history.
2. Keep a written inventory of the production Firebase project, Drive folder IDs, OAuth client ownership and authorised administrators. Do not put credentials or private keys in this repository.
3. Before any destructive migration or bulk deletion, take a verified Firestore export using an owner-approved method and confirm the export completed. Record the date, project, destination and operator.
4. Back up Google Drive content separately. A Firestore export contains file metadata/URLs, not the actual Drive file bytes or the complete effective Drive permission graph.
5. Do not treat browser downloads, CSV reports, audit logs or a GitHub source snapshot as a complete database backup.
6. Restrict backup destinations to authorised administrators. Encrypt and protect exports; they may contain personal, financial and educational information.
7. Set a retention period approved by the business and applicable legal obligations. Delete expired backup copies securely, including copies held by administrators.

If the business cannot fund or operate a supported backup service, record that limitation openly and do not claim disaster-recovery readiness.

## 4. Restore and recovery test

Perform a restore drill in a separate non-production Firebase project before relying on a backup:

1. Identify the exact export and confirm its completion timestamp and source project.
2. Restore into an isolated test project, never directly over production during a drill.
3. Confirm expected collections and representative document counts.
4. Verify role documents and least-privilege rules; do not assume the export restores Authentication users, custom claims, Drive file bytes or Drive permissions.
5. Confirm sample orders, payments, refunds, appointments and Institute enrolments are internally consistent.
6. Verify referenced Drive files still exist and access is limited to the intended accounts.
7. Record missing data, recovery duration and corrective actions.
8. Obtain owner approval before any production restore. A restore can overwrite newer records and should be treated as a controlled incident.

## 5. Security and access review

At least quarterly, and whenever a staff member leaves:

- Review Firebase Authentication users and disable accounts that should no longer sign in.
- Review every `roles/{uid}` document against the current staff roster. Remove or downgrade obsolete roles using the Super Admin account.
- Review Google Drive folder and file sharing, including inherited access and external collaborators.
- Review GitHub repository collaborators, Actions secrets/variables and deployment permissions.
- Confirm that only the intended Super Admin can access privileged settings and audit records.
- Never share passwords, Firebase service-account keys, OAuth client secrets or recovery codes in chat, source files, screenshots or issue reports.
- If a credential is exposed, revoke/rotate it at its issuing provider immediately and review recent sign-in and audit activity.

## 6. Incident response

For suspected account compromise, unauthorised disclosure, unexpected data changes or a failed deployment:

1. Record the time, affected account/record type and observed symptoms. Avoid copying unnecessary personal data into the incident notes.
2. Restrict or disable the affected account and revoke exposed credentials.
3. Preserve relevant GitHub Actions run links, Firebase Authentication activity, Firestore audit records and Drive activity where available.
4. Determine whether the issue is a UI defect, Firestore Rules permission, compromised account, Drive sharing issue or deployment problem.
5. Do not delete evidence or restore a backup until the impact and recovery point are understood.
6. Notify the business owner and follow the organisation's applicable privacy/breach notification obligations.
7. Apply the fix, deploy it, re-run the relevant automated checks and perform a focused role-based verification.
8. Record the cause, impact, remediation and any required customer communication.

## 7. Data access, correction and deletion requests

The in-app privacy request centre records requests; it does not automatically erase or correct every related record.

Before fulfilling a request, the authorised reviewer must:
- Verify the requester’s identity through an appropriate channel.
- Identify related records in Firestore, Firebase Authentication and Google Drive.
- Check financial, contractual, educational and other retention obligations.
- Preserve records subject to a lawful retention requirement or active dispute.
- Correct or delete only the records approved for action, including relevant Drive files and access grants.
- Record the decision, action taken, date and any reason a record was retained.
- Respond to the requester without exposing another person's information.

Deletion from the live database does not necessarily remove retained backups, logs, cached copies or third-party copies. State the actual scope accurately.

## 8. Deployment and rollback

- Every push to `main` triggers the GitHub Pages workflow.
- A green workflow confirms the automated build, browser smoke tests, source checks, Emulator rules tests and Pages deployment steps in that run. It does not prove production Firebase configuration, Drive permissions, bank settlement or all role workflows.
- Use the latest successful run as the deployment reference. If a deployment fails, inspect the failing job and logs before retrying.
- For a bad frontend release, revert the offending source commit through GitHub and allow the normal workflow to deploy the rollback.
- A frontend rollback does not roll back Firestore data, rules, Drive permissions or transactions. Treat those as separate recovery operations.
- Publish Firestore Rules separately with the Firebase CLI against the explicitly verified project. Review the project ID before running any deploy command.

## 9. Owner sign-off record

Keep this record outside the public repository, in a restricted business location:

| Item | Record |
|---|---|
| Production Firebase project ID | |
| Current rules publication date / operator | |
| Super Admin UID review date | |
| Google Drive owner and shared-folder ID | |
| Backup method, destination and cost approval | |
| Last successful backup and verification | |
| Last restore drill and result | |
| Last staff/role/Drive access review | |
| Privacy request reviewer | |
| Incident contact and escalation route | |

**Readiness statement:** Until backup, restore, access review and production acceptance are completed and evidenced, describe the application as deployed and automated checks passed—not as fully production-verified or disaster-recovery-ready.
